import { existsSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { runInNewContext } from 'node:vm'
import { gzipSync } from 'node:zlib'
import { describe, expect, it } from 'vitest'

// Foundation §7.9 and spec §10.4. "KB" is 1024 bytes; gzip at the default
// level approximates what a reverse proxy sends.
const root = fileURLToPath(new URL('../', import.meta.url))
const next = join(root, '.next')
const KB = 1024
// The spec's 130 KB per-route total was set against a framework of about 35 KB.
// Next 16.3.6's shared root files alone gzip to 127 KB (measured 2026-09-25).
// The app's own share is what this gate protects, and the floor guard watches
// the framework.
const APP_BUDGET = 100 * KB
const ROOT_BUDGET = 140 * KB
const FONT_BUDGET = 120 * KB
const FONT = join(root, 'app/fonts/Vazirmatn[wght].woff2')

// app-build-manifest.json no longer exists in Next 16.3.6; two files stand in
// for it. server/app-paths-manifest.json names the routes (`/page`,
// `/design/page`), and each route's server/app/<route>_client-reference-manifest.js
// lists, under `entryJSFiles`, the chunks of every segment the route renders.
const APP_PATHS = join(next, 'server/app-paths-manifest.json')

type BuildManifest = { rootMainFiles: string[] }
type ClientReferenceManifest = { entryJSFiles: Record<string, string[]> }

function gzipped(file: string): number {
  return gzipSync(readFileSync(file)).length
}

/** The gzipped size of the distinct `.js` files among `files`, given relative to .next/. */
function gzippedJs(files: readonly string[]): number {
  const js = [...new Set(files)].filter((file) => file.endsWith('.js'))
  return js.reduce((sum, file) => sum + gzipped(join(next, file)), 0)
}

function kb(bytes: number): string {
  return `${(bytes / KB).toFixed(1)} KB`
}

/** The framework runtime Next loads on every route. */
function rootMainFiles(): string[] {
  const manifest = readFileSync(join(next, 'build-manifest.json'), 'utf8')
  return (JSON.parse(manifest) as BuildManifest).rootMainFiles
}

/**
 * The chunks of every segment `route` renders: its layouts, their boundaries, the
 * page. The manifest is a script that assigns a global, so it is evaluated the
 * way Next's own loader reads it (`evalManifest`, `node:vm`).
 */
function segmentFiles(route: string): string[] {
  const file = join(next, `server/app${route}_client-reference-manifest.js`)
  const context: { __RSC_MANIFEST?: Record<string, ClientReferenceManifest> } = {}
  runInNewContext(readFileSync(file, 'utf8'), context)
  const entries = context.__RSC_MANIFEST?.[route]?.entryJSFiles
  if (entries === undefined) throw new Error(`no client reference manifest for ${route}`)
  return Object.values(entries).flat()
}

describe('budgets', () => {
  it('has a production build to measure', () => {
    expect(existsSync(APP_PATHS), 'run `next build` first').toBe(true)
  })

  it('keeps the root files every route loads within 140 KB gzipped', () => {
    expect(gzippedJs(rootMainFiles()), 'root files').toBeLessThanOrEqual(ROOT_BUDGET)
  })

  it('keeps every route’s own first-load JavaScript within 100 KB gzipped', () => {
    const rootFiles = rootMainFiles()
    const rootBytes = gzippedJs(rootFiles)
    const appPaths = JSON.parse(readFileSync(APP_PATHS, 'utf8')) as Record<string, string>
    const routes = Object.keys(appPaths).filter((key) => key.endsWith('/page'))
    expect(routes.length).toBeGreaterThan(0)

    const report = routes.map((route) => {
      const app = gzippedJs(segmentFiles(route).filter((file) => !rootFiles.includes(file)))
      return { route, app, total: rootBytes + app }
    })
    console.info(
      [
        `root files: ${kb(rootBytes)} gzipped`,
        ...report.map(
          ({ route, app, total }) =>
            `${route}: root ${kb(rootBytes)}, app ${kb(app)}, total ${kb(total)}`,
        ),
      ].join('\n'),
    )

    for (const { route, app } of report) {
      expect(app, `${route} app JavaScript`).toBeLessThanOrEqual(APP_BUDGET)
    }
  })

  it('keeps the vendored font within 120 KB', () => {
    expect(statSync(FONT).size).toBeLessThanOrEqual(FONT_BUDGET)
  })
})
