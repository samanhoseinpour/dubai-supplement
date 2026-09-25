import type { Linter } from 'eslint'

/**
 * The layers that need no type information — the Tailwind rules, the
 * route-segment-config ban, the import bans and the boundaries.
 * apps/web/test/lint.test.ts lints its fixtures with exactly these.
 */
export declare const webRules: Linter.Config[]

declare const config: Linter.Config[]
export default config
