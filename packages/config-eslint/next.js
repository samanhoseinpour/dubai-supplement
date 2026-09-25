// @ts-check
import { fileURLToPath } from 'node:url'
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals'
import betterTailwindcss from 'eslint-plugin-better-tailwindcss'
import boundaries from 'eslint-plugin-boundaries'
import tseslint from 'typescript-eslint'
import base from './base.js'

// Three layers on the strict TypeScript base (3a spec §11):
//   1. eslint-config-next — react, react-hooks, jsx-a11y, @next/next.
//   2. eslint-plugin-better-tailwindcss — the design system's class rules,
//      evaluated against app/globals.css so a deleted scale is an unknown class.
//   3. Project rules — the route-segment-config ban, the import bans and the
//      component boundaries.
//
// Flat-config note carried from Phase 2: a later object that sets
// `no-restricted-syntax` or `no-restricted-imports` REPLACES the earlier
// options, so every selector and every banned path lives in one object each.

const aliasResolver = fileURLToPath(new URL('./web-alias-resolver.js', import.meta.url))

// A class may carry any number of `variant:` prefixes and Tailwind's
// important marker in either position (`md:!leading-none`, `leading-none!`);
// every pattern below tolerates them so `md:ml-4` is judged like `ml-4`.
const VARIANTS = String.raw`^(?:[^\s:]+:)*!?`
// An arbitrary value opens with `[` (a literal) or `(` (a variable).
const ARBITRARY = String.raw`[\[(]`
// The utilities that carry colour, with an optional side or axis (`border-s-`).
const COLOUR_UTILITY = String.raw`(?:bg|text|border|ring|outline|fill|stroke|decoration|from|via|to|divide|placeholder|accent|caret)(?:-[a-z]{1,2})?`
const LENGTH_UNIT = String.raw`(?:px|r?em|%|ch|ex|lh|rlh|cap|ic|pt|pc|in|cm|mm|[sdl]?v(?:w|h|i|b|min|max)|cq(?:w|h|i|b|min|max))`

const ROUTE_SEGMENT_CONFIGS = ['dynamic', 'revalidate', 'fetchCache', 'runtime', 'dynamicParams']

const FONT_GOOGLE = {
  name: 'next/font/google',
  message: 'Vazirmatn is vendored and loaded with next/font/local (foundation §7.2).',
}
const LUCIDE = {
  name: 'lucide-react',
  message:
    'Icons come from lib/icons.ts under semantic names — IconForward, not ChevronLeft (spec §8.2).',
}
// pnpm's isolation makes `apps/api` unresolvable by its package name; a
// relative path into it resolves, so the specifier itself is banned.
const API_BOUNDARY = {
  regex: String.raw`(^|/)apps/api(/|$)|(^|/)api/(src|dist)/`,
  message:
    'api-boundary: apps/web never imports apps/api, not even types — use @ds/contracts, @ds/api-client and @ds/persian (north-star §2.3).',
}

// Layer 1. eslint-config-next's first object declares an `import/resolver`
// setting naming `eslint-import-resolver-typescript`, a package this
// workspace does not install; layer 3 declares its own resolver chain for the
// boundaries plugin, so that setting is dropped rather than merged. Its
// `react.version: 'detect'` is replaced with the major pinned in the catalog:
// eslint-plugin-react 7.37's detection calls the `context.getFilename()` that
// ESLint 10 removed and crashes on the first file, and the major is all its
// feature gates read. The babel parser it sets for JavaScript files is
// replaced below with typescript-eslint's, which parses the config files here
// without reaching into `next/dist`.
const REACT_MAJOR = '19'

const nextLayer = nextCoreWebVitals.map((config) => {
  if (config.name !== 'next' || config.settings === undefined) return config
  return { ...config, settings: { react: { version: REACT_MAJOR } } }
})

const javascriptParser = {
  files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
  languageOptions: { parser: tseslint.parser },
}

// Layer 2. A class gets the first message that matches, so the namespace
// patterns come before the generic literal-length one.
const RESTRICTED_CLASSES = [
  {
    pattern: String.raw`\[(?:#|rgba?\(|hsla?\(|oklch\(|oklab\(|lab\(|lch\(|color\()`,
    message: 'arbitrary-colour: only the tokens in app/globals.css carry colour (spec §5.1).',
  },
  {
    pattern: String.raw`${VARIANTS}${COLOUR_UTILITY}-(?:\[(?:var\(|color:|--|color-mix\(|[a-zA-Z]+\])|\((?:color:)?--)`,
    message:
      'variable-colour: a colour reaches a component only as a token utility — bg-primary, never bg-(--x), bg-[var(--x)] or text-[red] (spec §5.1).',
  },
  {
    pattern: String.raw`${VARIANTS}(?:duration|delay)-(?:\d|\[|\((?!--duration-))`,
    message:
      'duration: motion runs on the --duration-press|quick|fade tokens — duration-(--duration-quick), never duration-300 (spec §7.2).',
  },
  {
    pattern: String.raw`${VARIANTS}ease-(?:\[|\((?!--ease-))`,
    message: 'easing: only ease-out and ease-in exist — never a literal curve (spec §7.2).',
  },
  {
    pattern: String.raw`${VARIANTS}(?:animate|text|leading|font)-${ARBITRARY}`,
    message:
      'arbitrary-scale: the type, weight, leading and animation scales are the tokens; an arbitrary value is outside them (spec §5.4, §6).',
  },
  {
    pattern: String.raw`${VARIANTS}rounded-(?:[a-z]{1,2}-)?${ARBITRARY}`,
    message: 'arbitrary-radius: only rounded-sm, -md, -lg and -full exist (spec §5.4).',
  },
  {
    pattern: String.raw`${VARIANTS}(?:inset-)?shadow-${ARBITRARY}`,
    message: 'arbitrary-shadow: only shadow-sm, shadow-md and material exist (spec §5.4).',
  },
  {
    pattern: `${VARIANTS}-?tracking-`,
    message: 'tracking: letter-spacing is never set — connected letters tear apart (spec §6.3).',
  },
  {
    pattern: `${VARIANTS}leading-(?:none|tight)!?$`,
    message: 'leading: every size in the scale carries its own leading (spec §6.3).',
  },
  {
    pattern: `${VARIANTS}text-(?:left|right|justify)!?$`,
    message:
      'alignment: everything is start-aligned; centring is for empty states and the hero (spec §6.3).',
  },
  {
    pattern: `${VARIANTS}float-`,
    message: 'float: physical layout — use flex or grid with logical gaps (spec §11).',
  },
  {
    pattern: `${VARIANTS}rounded-(?:tl|tr|bl|br)(?:-|$)`,
    message: 'corners: physical corner radii — use rounded-ss, -se, -es, -ee (foundation §7.2).',
  },
  {
    pattern: String.raw`${VARIANTS}-?z-(?:\d+|${ARBITRARY})`,
    message: 'z-index: only z-header, z-overlay, z-sheet and z-toast exist (spec §5.4).',
  },
  {
    // Tailwind's built-in `dark` and `not-dark` variants are
    // `prefers-color-scheme` queries, so deleting the custom variant alone
    // leaves both known classes.
    pattern: `${VARIANTS}(?:not-)?dark:`,
    message: 'dark-variant: there is one light theme; no `dark:` variant exists (ADR-0021).',
  },
  {
    // The same query spelled out as an arbitrary at-rule variant.
    pattern: 'prefers-color-scheme',
    message:
      'dark-variant: no class may answer prefers-color-scheme; there is one light theme (ADR-0021).',
  },
  {
    // A value that is, or opens with, a number carrying a length unit:
    // `[13px]`, `[1px_2px]`, `[30%]`. calc() and var() bodies are not judged.
    pattern: String.raw`\[-?(?:\d+\.?\d*|\.\d+)${LENGTH_UNIT}(?![a-z])`,
    message:
      'literal-length: sizes come from the spacing scale and the tokens — p-4, max-w-prose, never w-[13px] (spec §5.4, §11).',
  },
]

// enforce-logical-properties also maps the block axis and dimensions to
// logical utilities (mt- → mbs-, w- → inline-). The requirement is RTL
// correctness (foundation §7.2), which is the inline axis: block-axis and
// dimension utilities never mirror between LTR and RTL, and their logical
// forms are unfamiliar to every Tailwind reader, so they are ignored; every
// left/right class stays enforced.
const NOT_INLINE_AXIS = [
  String.raw`^(?:[^\s:]+:)*-?(?:m|p|scroll-m|scroll-p)(?:t|b|y)-`,
  String.raw`^(?:[^\s:]+:)*-?(?:top|bottom|inset-y)-`,
  String.raw`^(?:[^\s:]+:)*(?:min-|max-)?(?:w|h|size)-`,
  String.raw`^(?:[^\s:]+:)*border-(?:t|b|y)(?:-|$)`,
  String.raw`^(?:[^\s:]+:)*rounded-(?:t|b)(?:-|$)`,
  String.raw`^(?:[^\s:]+:)*(?:divide|space)-y(?:-|$)`,
]

const tailwindLayer = {
  files: ['**/*.ts', '**/*.tsx'],
  plugins: { 'better-tailwindcss': betterTailwindcss },
  settings: {
    // Relative to the package ESLint runs in — turbo and the regression suite
    // both run from apps/web.
    'better-tailwindcss': { entryPoint: 'app/globals.css' },
  },
  rules: {
    'better-tailwindcss/enforce-logical-properties': ['error', { ignore: NOT_INLINE_AXIS }],
    'better-tailwindcss/no-unknown-classes': 'error',
    'better-tailwindcss/no-conflicting-classes': 'error',
    'better-tailwindcss/no-duplicate-classes': 'error',
    'better-tailwindcss/no-restricted-classes': ['error', { restrict: RESTRICTED_CLASSES }],
  },
}

// Layer 3.
const routeSegmentConfigBan = {
  files: ['app/**/*.ts', 'app/**/*.tsx'],
  rules: {
    'no-restricted-syntax': [
      'error',
      {
        selector: `ExportNamedDeclaration > VariableDeclaration > VariableDeclarator > Identifier.id[name=/^(?:${ROUTE_SEGMENT_CONFIGS.join('|')})$/]`,
        message:
          'route-segment-config: Cache Components and route segment configs express the same intent two incompatible ways (ADR-0006, spec §11).',
      },
    ],
  },
}

const importBans = {
  files: ['**/*.ts', '**/*.tsx'],
  rules: {
    'no-restricted-imports': ['error', { paths: [FONT_GOOGLE, LUCIDE], patterns: [API_BOUNDARY] }],
  },
}

// The one file that may import lucide-react. The whole option object is
// restated on purpose (see the flat-config note above).
const iconsFile = {
  files: ['lib/icons.ts'],
  rules: {
    'no-restricted-imports': ['error', { paths: [FONT_GOOGLE], patterns: [API_BOUNDARY] }],
  },
}

const boundariesLayer = {
  files: ['**/*.ts', '**/*.tsx'],
  plugins: { boundaries },
  settings: {
    // Ours first for `@/`, the Node resolver for everything it declines.
    'import/resolver': {
      [aliasResolver]: {},
      node: { extensions: ['.js', '.jsx', '.ts', '.tsx'] },
    },
    // `partialMatch: false` anchors every folder at the package root, as
    // nest.js does, so a file anywhere under app/ belongs to the `app`
    // element and one under components/ui/ to `ui`. (v7 deprecates the
    // equivalent `mode: 'full'` and warns on every run.)
    'boundaries/elements': [
      { type: 'app', pattern: 'app', partialMatch: false },
      { type: 'ui', pattern: 'components/ui', partialMatch: false },
      { type: 'site', pattern: 'components/site', partialMatch: false },
      { type: 'lib', pattern: 'lib', partialMatch: false },
    ],
    'boundaries/files': [
      { category: 'test', pattern: '**/*.test.ts' },
      { category: 'test', pattern: '**/*.test.tsx' },
      { category: 'test', pattern: 'e2e/**/*.spec.ts' },
    ],
  },
  rules: {
    'boundaries/dependencies': [
      'error',
      {
        // Spec §4.3: `app` may import anything, so the default is allow and
        // the policies are the four exceptions. Each message opens with the
        // policy's name so the regression suite can assert the set exists.
        default: 'allow',
        policies: [
          {
            from: { element: { type: 'lib' } },
            disallow: { to: { element: { types: { anyOf: ['ui', 'site', 'app'] } } } },
            message:
              'lib-imports-packages-only: lib/** imports workspace packages and lib/** — never a component or a route (spec §4.3).',
          },
          {
            from: { element: { type: 'ui' } },
            disallow: { to: { element: { types: { anyOf: ['site', 'app'] } } } },
            message:
              'ui-imports-lib-only: components/ui/** imports lib/** and other primitives — never components/site/** or app/** (spec §4.3).',
          },
          {
            from: { element: { type: 'site' } },
            disallow: { to: { element: { type: 'app' } } },
            message:
              'site-never-imports-app: components/site/** composes ui/** and lib/** — never app/** (spec §4.3).',
          },
          {
            disallow: { to: { file: { categories: 'test' } } },
            message: 'no-test-imports: nothing imports a test file.',
          },
        ],
      },
    ],
  },
}

/** The layers that need no type information; apps/web/test/lint.test.ts lints with exactly these. */
export const webRules = [
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: { parser: tseslint.parser },
  },
  tailwindLayer,
  routeSegmentConfigBan,
  importBans,
  iconsFile,
  boundariesLayer,
]

export default [...base, ...nextLayer, javascriptParser, ...webRules]
