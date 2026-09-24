// The Swagger UI under the API's Content-Security-Policy, checked in a real
// browser. `app.inject()` cannot see a CSP violation: the server answers 200
// whether or not the browser then refuses a script, so the inject test only
// pins that @nestjs/swagger's template has no inline script or handler. The
// risk a swagger-ui-dist bump carries is inside the bundle — eval, new
// Function, a Worker, a foreign fetch — and only a browser can see it.
//
// Boots the BUILT app (`pnpm --filter api build` first) with
// OPENAPI_UI_ENABLED=true on an ephemeral loopback port, opens /docs in
// headless Chrome over the DevTools Protocol, expands the first GET, clicks
// "Try it out" and "Execute", and fails on any CSP refusal, console error,
// uncaught exception, request to a foreign host, or a page that did not
// render. Needs a browser, a port, apps/api/.env and the Redis the throttler
// counts in (`pnpm db:up`) — which is why it is not part of `pnpm check`.
//
//   node test/manual/csp/check.mjs             # PASS or FAIL, exit code to match
//   node test/manual/csp/check.mjs --control   # rewrites the page's CSP to
//                                              # script-src 'none' on the way in;
//                                              # must report refusals, or the
//                                              # detector itself is broken
//
// Required after any swagger-ui-dist or @nestjs/swagger bump (.claude/rules/api.md).

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync } from 'node:fs'
import { access } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'

const API_ROOT = fileURLToPath(new URL('../../../', import.meta.url))
const control = process.argv.includes('--control')
const TRY_PATH =
  process.argv.find((a) => a.startsWith('--try='))?.slice('--try='.length) ?? '/health/live'
const CHROME_CANDIDATES = [
  process.env.CHROME,
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
].filter((c) => typeof c === 'string' && c.length > 0)

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms))

async function findChrome() {
  for (const candidate of CHROME_CANDIDATES) {
    try {
      await access(candidate)
      return candidate
    } catch {
      // try the next one
    }
  }
  throw new Error('No Chrome or Chromium found; set CHROME=/path/to/the/binary')
}

// 1. The built app, exactly as main.ts boots it, on a port nobody else holds.
process.chdir(API_ROOT) // ConfigModule reads .env from the working directory
process.env.OPENAPI_UI_ENABLED = 'true'
process.env.LOG_LEVEL ??= 'fatal'
const { createApp } = await import(new URL('../../../dist/app.factory.js', import.meta.url).href)
const app = await createApp()
await app.listen({ port: 0, host: '127.0.0.1' })
const origin = await app.getUrl()
const target = `${origin}/docs`

// 2. Headless Chrome with a throwaway profile, driven over CDP.
const chromePath = await findChrome()
const profile = mkdtempSync(join(tmpdir(), 'ds-csp-'))
const chrome = spawn(chromePath, [
  '--headless=new',
  '--disable-gpu',
  '--no-first-run',
  '--no-default-browser-check',
  `--user-data-dir=${profile}`,
  '--remote-debugging-port=0',
  'about:blank',
])
let chromeStderr = ''
const wsUrl = await new Promise((resolve, reject) => {
  chrome.stderr.on('data', (chunk) => {
    chromeStderr += chunk
    const match = /DevTools listening on (ws:\/\/\S+)/u.exec(chromeStderr)
    if (match) resolve(match[1])
  })
  chrome.on('exit', (code) => {
    reject(
      new Error(`Chrome exited before exposing DevTools (code ${String(code)})\n${chromeStderr}`),
    )
  })
  setTimeout(() => {
    reject(new Error('Chrome exposed no DevTools endpoint within 30 s'))
  }, 30_000)
})

const ws = new WebSocket(wsUrl)
await new Promise((resolve, reject) => {
  ws.onopen = resolve
  ws.onerror = reject
})
let nextId = 1
const pending = new Map()
const listeners = []
ws.onmessage = (event) => {
  const message = JSON.parse(String(event.data))
  if (message.id !== undefined && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id)
    pending.delete(message.id)
    if (message.error) reject(new Error(JSON.stringify(message.error)))
    else resolve(message.result)
    return
  }
  if (message.method) for (const listener of listeners) listener(message)
}
const send = (method, params = {}, sessionId) =>
  new Promise((resolve, reject) => {
    const id = nextId++
    pending.set(id, { resolve, reject })
    ws.send(JSON.stringify({ id, method, params, ...(sessionId ? { sessionId } : {}) }))
  })
const on = (listener) => {
  listeners.push(listener)
}

const { targetId } = await send('Target.createTarget', { url: 'about:blank' })
const { sessionId } = await send('Target.attachToTarget', { targetId, flatten: true })
const page = (method, params) => send(method, params, sessionId)

const refusals = []
const otherLog = []
const consoleErrors = []
const exceptions = []
const requests = []
let cspHeader = ''
on((message) => {
  if (message.sessionId !== sessionId) return
  const { method, params } = message
  if (method === 'Log.entryAdded') {
    const { entry } = params
    if (entry.source === 'security' || /Content Security Policy|Refused to/iu.test(entry.text)) {
      refusals.push(entry.text)
    } else {
      otherLog.push(`${entry.source}/${entry.level}: ${entry.text}`)
    }
  }
  if (method === 'Runtime.consoleAPICalled' && params.type === 'error') {
    consoleErrors.push(params.args.map((arg) => arg.value ?? arg.description).join(' '))
  }
  if (method === 'Runtime.exceptionThrown') {
    const details = params.exceptionDetails
    exceptions.push(details.exception?.description ?? details.text)
  }
  if (method === 'Network.requestWillBeSent') {
    requests.push(`${params.request.method} ${params.request.url}`)
  }
  if (method === 'Network.responseReceived' && params.type === 'Document' && !cspHeader) {
    const headers = params.response.headers
    const key = Object.keys(headers).find((k) => k.toLowerCase() === 'content-security-policy')
    if (key !== undefined) cspHeader = headers[key]
  }
})

await page('Page.enable')
await page('Log.enable')
await page('Runtime.enable')
await page('Network.enable')

if (control) {
  // The positive control: the real page, the real bundle, but the document
  // response's policy swapped for one that must break it. Zero refusals here
  // would mean the detector, not the page, is at fault.
  await page('Fetch.enable', { patterns: [{ urlPattern: target, requestStage: 'Response' }] })
  on((message) => {
    if (message.sessionId !== sessionId || message.method !== 'Fetch.requestPaused') return
    const { requestId, responseHeaders = [], responseStatusCode } = message.params
    // A synthesised response: header overrides on `Fetch.continueResponse`
    // reach the Network domain but not CSP enforcement, so the document is
    // re-served whole. Framing headers are dropped; Chrome recomputes them.
    const DROPPED = new Set([
      'content-security-policy',
      'content-length',
      'content-encoding',
      'transfer-encoding',
    ])
    const rewritten = responseHeaders
      .filter((h) => !DROPPED.has(h.name.toLowerCase()))
      .concat({ name: 'content-security-policy', value: "script-src 'none'" })
    page('Fetch.getResponseBody', { requestId })
      .then(({ body, base64Encoded }) =>
        page('Fetch.fulfillRequest', {
          requestId,
          responseCode: responseStatusCode,
          responseHeaders: rewritten,
          body: base64Encoded ? body : Buffer.from(body).toString('base64'),
        }),
      )
      .catch((error) => {
        exceptions.push(`control: could not re-serve the document: ${String(error)}`)
      })
  })
}

const loaded = new Promise((resolve) => {
  on((message) => {
    if (message.sessionId === sessionId && message.method === 'Page.loadEventFired') resolve()
  })
})
await page('Page.navigate', { url: target })
await Promise.race([loaded, sleep(20_000)])
await sleep(2_500) // React has rendered by now, or never will

const evaluate = async (expression) => {
  const { result } = await page('Runtime.evaluate', {
    expression,
    returnByValue: true,
    awaitPromise: true,
  })
  return result.value
}

const rendered = await evaluate(`({
  title: document.title,
  swaggerRoot: !!document.querySelector('.swagger-ui'),
  infoTitle: document.querySelector('.swagger-ui .info .title')?.textContent ?? null,
  opblocks: document.querySelectorAll('.opblock').length,
  validatorBadge: !!document.querySelector('img[src*="validator.swagger.io"]'),
  scripts: [...document.scripts].map((s) => s.src || '(inline)'),
})`)

// 3. "Try it out" on the GET of TRY_PATH — the request the UI makes to the API
// itself, which default-src governs.
let tryItOut = null
if (rendered.opblocks > 0) {
  const click = (selector) =>
    evaluate(`(() => {
      const el = document.querySelector(${JSON.stringify(selector)})
      if (!el) return 'missing: ' + ${JSON.stringify(selector)}
      el.click()
      return 'clicked'
    })()`)
  const expanded = await evaluate(`(() => {
    const block = [...document.querySelectorAll('.opblock')].find((b) =>
      b.querySelector('.opblock-summary-method')?.textContent === 'GET' &&
      b.querySelector('.opblock-summary-path')?.textContent.includes(${JSON.stringify(TRY_PATH)}))
    if (!block) return 'no GET block for ' + ${JSON.stringify(TRY_PATH)}
    block.id = 'csp-check-target'
    ;(block.querySelector('button.opblock-summary-control') ?? block.querySelector('.opblock-summary')).click()
    return 'expanded'
  })()`)
  await sleep(1_500)
  const tryOut = await click('#csp-check-target .try-out__btn')
  await sleep(500)
  const execute = await click('#csp-check-target .execute')
  await sleep(2_500)
  const outcome = await evaluate(`(() => {
    const block = document.querySelector('#csp-check-target')
    return {
      status: block?.querySelector('.live-responses-table tbody .response-col_status')?.textContent ?? null,
      body: (block?.querySelector('.live-responses-table .microlight')?.textContent ?? '').slice(0, 120) || null,
    }
  })()`)
  tryItOut = { expanded, tryOut, execute, ...outcome }
}
await sleep(500)

// 4. Verdict.
const foreign = requests.filter((r) => !r.includes(origin) && !r.includes(' data:'))
const report = {
  mode: control ? "control (CSP rewritten to script-src 'none')" : 'real policy',
  target,
  cspHeader,
  rendered,
  tryItOut,
  requests,
  foreignRequests: foreign,
  cspRefusals: refusals,
  consoleErrors,
  exceptions,
  otherLog,
}
console.log(JSON.stringify(report, null, 2))

let failures
if (control) {
  failures =
    refusals.length > 0 ? [] : ['control: no CSP refusal recorded — the detector is broken']
} else {
  failures = [
    ...(refusals.length > 0 ? [`${String(refusals.length)} CSP refusal(s)`] : []),
    ...(consoleErrors.length > 0 ? [`${String(consoleErrors.length)} console error(s)`] : []),
    ...(exceptions.length > 0 ? [`${String(exceptions.length)} uncaught exception(s)`] : []),
    ...(foreign.length > 0 ? [`${String(foreign.length)} request(s) to a foreign host`] : []),
    ...(rendered.swaggerRoot && rendered.opblocks > 0 ? [] : ['the UI did not render']),
    ...(tryItOut?.status === '200' ? [] : [`"Try it out" did not get a 200 from ${TRY_PATH}`]),
  ]
}
console.log(failures.length === 0 ? 'VERDICT: PASS' : `VERDICT: FAIL — ${failures.join('; ')}`)

// 5. Tidy up, whatever the verdict.
try {
  await send('Browser.close')
} catch {
  // Chrome may already be gone
}
chrome.kill('SIGKILL')
await app.close()
rmSync(profile, { recursive: true, force: true })
process.exit(failures.length === 0 ? 0 : 1)
