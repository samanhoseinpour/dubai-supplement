import { existsSync, readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import { fileURLToPath } from 'node:url'
import { ESLint } from 'eslint'
import { describe, expect, it } from 'vitest'

/**
 * `turbo run boundaries` was declared in `turbo.json` from the first task and
 * matched no package for sixteen of them, so every "`pnpm check` green" on this
 * branch silently excluded boundary enforcement. This file is the regression
 * guard for that specific failure: it asserts both halves of the enforcement —
 * the graph-wide rules dependency-cruiser owns and the per-file barrel rules
 * `eslint-plugin-boundaries` owns — exist by name, and that the task carrying
 * them is wired into `pnpm check` rather than merely declared.
 *
 * A rule nothing runs is decoration. A task nothing matches is worse: it
 * reports success.
 */

const apiDir = fileURLToPath(new URL('..', import.meta.url))
const repoRoot = fileURLToPath(new URL('../../../', import.meta.url))
const require = createRequire(import.meta.url)

type CruiserRule = { readonly name?: string; readonly severity?: string }
type CruiserConfig = {
  readonly forbidden?: readonly CruiserRule[]
  readonly options?: { readonly tsConfig?: { readonly fileName?: string } }
}

type PackageJson = {
  readonly scripts?: Readonly<Record<string, string>>
  readonly devDependencies?: Readonly<Record<string, string>>
}

type TurboJson = { readonly tasks?: Readonly<Record<string, unknown>> }

type ElementDescriptor = { readonly type?: string; readonly pattern?: string }
type BoundariesPolicy = { readonly message?: string }
type BoundariesOptions = {
  readonly default?: string
  readonly policies?: readonly BoundariesPolicy[]
}
type FlatConfigSnapshot = {
  readonly settings?: Readonly<Record<string, unknown>>
  readonly rules?: Readonly<Record<string, readonly unknown[]>>
}

const readJson = (path: string): unknown => JSON.parse(readFileSync(path, 'utf8')) as unknown

const cruiserConfig = require('../.dependency-cruiser.cjs') as CruiserConfig
const apiPackage = readJson(`${apiDir}package.json`) as PackageJson
const rootPackage = readJson(`${repoRoot}package.json`) as PackageJson
const turboJson = readJson(`${repoRoot}turbo.json`) as TurboJson

describe('.dependency-cruiser.cjs', () => {
  // The five graph-wide rules of north-star §2 / spec §5.3. Renaming one is
  // fine; losing one is not, and losing one is invisible without this list.
  const expected = [
    'no-cross-module-internals',
    'domain-is-pure',
    'application-uses-ports',
    'shared-and-infra-are-leaves',
    'no-circular',
  ]

  it('declares every graph-wide rule', () => {
    const names = (cruiserConfig.forbidden ?? []).map((rule) => rule.name)
    expect(names).toEqual(expected)
  })

  it('declares every rule at severity error, so a violation fails the build', () => {
    const severities = (cruiserConfig.forbidden ?? []).map((rule) => rule.severity)
    expect(severities).toEqual(expected.map(() => 'error'))
  })

  it('resolves TypeScript through the package tsconfig', () => {
    expect(cruiserConfig.options?.tsConfig?.fileName).toBe('tsconfig.json')
  })
})

describe('the boundaries task', () => {
  it('runs dependency-cruiser over src with the committed config', () => {
    const script = apiPackage.scripts?.boundaries ?? ''
    expect(script).toContain('depcruise')
    expect(script).toContain('src')
    expect(script).toContain('.dependency-cruiser.cjs')
  })

  it('has dependency-cruiser installed from the catalog', () => {
    expect(apiPackage.devDependencies?.['dependency-cruiser']).toBe('catalog:')
    // The binary the script names, not just the entry in package.json: a
    // declared-but-unreferenced tool is the failure this task exists to end.
    expect(existsSync(`${apiDir}node_modules/.bin/depcruise`)).toBe(true)
  })

  it('is declared in turbo.json', () => {
    expect(turboJson.tasks).toHaveProperty('boundaries')
  })

  it('is part of pnpm check and pnpm check:affected', () => {
    expect(rootPackage.scripts?.check).toContain('boundaries')
    expect(rootPackage.scripts?.['check:affected']).toContain('boundaries')
  })
})

// The first ESLint call in each block below does the expensive part once: the
// first `calculateConfigForFile` loads apps/api/eslint.config.js and every
// plugin it imports, and the first `lintText` builds the type-aware program
// `projectService` needs. Each is under two seconds on a developer machine and
// past vitest's 5 s default on CI's 2-vCPU runner, where both have failed —
// the config load took 7 s on a cold runner. The budget is deliberately far
// above the cost rather than just over it — a timeout tuned to the observed
// number turns a slow runner into a red build, and none of these assertions
// has anything to say about speed.
const LINT_TIMEOUT_MS = 60_000

describe('eslint-plugin-boundaries', () => {
  // Resolved the way ESLint itself resolves it, so the assertions are about the
  // config the linter actually applies to apps/api and not about a file that
  // may or may not be reachable from it.
  const configFor = async (relativeFile: string): Promise<FlatConfigSnapshot> => {
    const eslint = new ESLint({ cwd: apiDir })
    return (await eslint.calculateConfigForFile(`${apiDir}${relativeFile}`)) as FlatConfigSnapshot
  }

  it(
    'classifies the layout that exists: infra/*, shared/* and modules/*',
    async () => {
      const config = await configFor('src/infra/db/db.module.ts')
      const elements = (config.settings?.['boundaries/elements'] ??
        []) as readonly ElementDescriptor[]
      const byType = new Map(elements.map((element) => [element.type, element.pattern]))

      expect(byType.get('infra')).toBe('src/infra/*')
      expect(byType.get('shared')).toBe('src/shared/*')
      expect(byType.get('domain')).toBe('src/modules/*/domain')
      expect(byType.get('application')).toBe('src/modules/*/application')
      expect(byType.get('module-infrastructure')).toBe('src/modules/*/infrastructure')
    },
    LINT_TIMEOUT_MS,
  )

  it(
    'enforces its rules as errors, by name',
    async () => {
      const config = await configFor('src/infra/db/db.module.ts')
      const entry = config.rules?.['boundaries/dependencies'] ?? []
      expect(entry[0]).toBe(2)

      const options = entry[1] as BoundariesOptions
      expect(options.default).toBe('allow')
      const names = (options.policies ?? []).map((policy) => policy.message?.split(':')[0])
      expect(names).toEqual([
        'infra-barrel',
        'infra-barrel-migrate-allowance',
        'shared-barrel',
        'domain-has-no-sibling-layers',
      ])
    },
    LINT_TIMEOUT_MS,
  )
})

/**
 * The assertions above prove the policies are *declared*. These prove they
 * *report*, and they exist because two settings silence every one of them
 * without touching a policy:
 *
 * - `import/resolver` — `eslint-plugin-boundaries` resolves through
 *   `eslint-module-utils`, whose Node resolver cannot map the ESM specifier
 *   `./infra/db/index.js` onto `index.ts`. An unresolved target is an unknown
 *   element, and `getDependencyRule` skips unknown local targets because
 *   `checkUnknownLocals` defaults to `false`.
 * - `boundaries/files` — `dependencyRule` returns no visitors at all for a
 *   file that is unknown in both dimensions, which is every entrypoint and
 *   every file under `test/`.
 *
 * Delete either and the fixtures below go quiet while `pnpm check` stays
 * green. That is the failure this whole task was about, so it is asserted by
 * linting rather than by reading the config back.
 */
describe('eslint-plugin-boundaries actually reports', () => {
  const eslint = new ESLint({ cwd: apiDir })

  // Real paths with substituted content: the config ESLint resolves is the one
  // the file would really get, and no fixture is written to disk.
  const boundaryErrors = async (relativeFile: string, code: string): Promise<string[]> => {
    const [result] = await eslint.lintText(code, { filePath: `${apiDir}${relativeFile}` })
    return (result?.messages ?? [])
      .filter((message) => message.ruleId === 'boundaries/dependencies')
      .map((message) => message.message)
  }

  it.each([
    [
      'between two infra directories — guards import/resolver',
      'src/infra/http/security.ts',
      "import { DRIZZLE } from '../db/drizzle.provider.js'\nexport const probe = DRIZZLE\n",
    ],
    [
      'from an entrypoint — guards the entrypoint file category',
      'src/app.module.ts',
      "import { DRIZZLE } from './infra/db/drizzle.provider.js'\nexport const probe = DRIZZLE\n",
    ],
    [
      'from the integration suite — guards the test file category',
      'test/integration/health.test.ts',
      "import { DRIZZLE } from '../../src/infra/db/drizzle.provider.js'\nexport const probe = DRIZZLE\n",
    ],
  ])(
    'reports infra-barrel on a deep import %s',
    async (_label, relativeFile, code) => {
      const messages = await boundaryErrors(relativeFile, code)
      expect(messages).toHaveLength(1)
      expect(messages[0]).toMatch(/^infra-barrel:/)
    },
    // The first lintText builds the type-aware program — see LINT_TIMEOUT_MS.
    LINT_TIMEOUT_MS,
  )

  it(
    'stays silent on the barrel import it exists to permit',
    async () => {
      const messages = await boundaryErrors(
        'src/infra/http/security.ts',
        "import { DRIZZLE } from '../db/index.js'\nexport const probe = DRIZZLE\n",
      )
      expect(messages).toEqual([])
    },
    LINT_TIMEOUT_MS,
  )
})
