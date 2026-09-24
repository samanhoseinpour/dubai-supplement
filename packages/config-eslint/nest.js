// @ts-check
import { fileURLToPath } from 'node:url'
import boundaries from 'eslint-plugin-boundaries'
import base from './base.js'

// `eslint-module-utils` loads a resolver by module name or by path, never as
// an inline object, so the one that maps `./x.js` onto `./x.ts` ships as a
// file next to this config and is named here by its absolute path.
const esmTsResolver = fileURLToPath(new URL('./esm-ts-resolver.js', import.meta.url))

export default [
  ...base,
  // Module boundaries, ESLint's half (spec §4.1, north-star §2).
  //
  // The split with `dependency-cruiser` is deliberate and not a duplication:
  // dependency-cruiser sees the whole graph and owns the rules that need it —
  // cycles, cross-module internals, the purity of `domain/**` against the
  // driver packages, `application/**` against `infrastructure/**`, and
  // `shared|infra` against `modules/**`. ESLint sees one file at a time, in
  // the editor, while the import is being typed, which is where a wrong import
  // is cheapest to fix — so it owns the "enter only through the barrel" rules
  // and the one graph-free check dependency-cruiser's `domain-is-pure` does
  // not make: that `domain/**` imports no sibling layer.
  //
  // `boundaries/dependencies` is the canonical rule. `boundaries/entry-point`
  // would read better by name, but v7 deprecates it in favour of this one and
  // implements it by rewriting its options into these policies anyway.
  //
  // Each policy's `message` opens with the policy's name, so a violation names
  // the rule that produced it and the test can assert the set still exists.
  {
    files: ['**/*.ts'],
    plugins: { boundaries },
    settings: {
      // Ours first, the Node resolver after it for everything ours declines.
      'import/resolver': { [esmTsResolver]: {}, node: {} },
      // `partialMatch: false` anchors every pattern at the package root, so
      // `src/infra/db` is an element and `dist/src/infra/db` is not.
      'boundaries/elements': [
        { type: 'infra', pattern: 'src/infra/*', capture: ['dir'], partialMatch: false },
        { type: 'shared', pattern: 'src/shared/*', capture: ['dir'], partialMatch: false },
        {
          type: 'domain',
          pattern: 'src/modules/*/domain',
          capture: ['module'],
          partialMatch: false,
        },
        {
          type: 'application',
          pattern: 'src/modules/*/application',
          capture: ['module'],
          partialMatch: false,
        },
        {
          type: 'module-infrastructure',
          pattern: 'src/modules/*/infrastructure',
          capture: ['module'],
          partialMatch: false,
        },
        { type: 'module', pattern: 'src/modules/*', capture: ['module'], partialMatch: false },
      ],
      // The entrypoints and the out-of-tree test suite belong to no element,
      // and the rule skips a file that is unknown in both dimensions. Naming
      // them here is what makes `src/migrate.ts` and `test/integration/**`
      // subject to the barrel rule instead of silently exempt from it.
      'boundaries/files': [
        { category: 'entrypoint', pattern: 'src/*.ts' },
        { category: 'test', pattern: 'test/**/*.ts' },
      ],
    },
    rules: {
      'boundaries/dependencies': [
        'error',
        {
          // Phase 2 has one aggregate-free tree; an import this config says
          // nothing about is allowed. The policies below are the exceptions.
          default: 'allow',
          policies: [
            {
              to: { element: { type: 'infra' } },
              disallow: { to: { element: { fileInternalPath: '!index.ts' } } },
              message:
                'infra-barrel: src/infra/<dir> is entered only through its index.ts (north-star §2). Importing a file inside it from outside makes that file public without anyone deciding it should be.',
            },
            {
              // The one allowance, and its cause is the same in all three
              // cases: importing `infra/config` or `infra/db` through the
              // barrel pulls in `ConfigModule`, whose `forRoot` validates the
              // environment at import time — before `migrate.ts` has loaded
              // its own `.env`. Each target is a leaf that imports nothing and
              // says so in its own header. `migrate.test.ts` is colocated and
              // needs the same reach. Anything else from these two files is
              // still caught by `infra-barrel` above.
              from: { file: { path: ['src/migrate.ts', 'src/migrate.test.ts'] } },
              to: { element: { type: 'infra' } },
              // The two lists are exact complements, and both are needed: the
              // `allow` is what lifts the blanket `infra-barrel` above, and the
              // `disallow` is what keeps the allowance to these three names
              // instead of opening both directories.
              disallow: {
                to: {
                  element: {
                    fileInternalPath: '!(index|env.schema|migration-lock|connect-timeout).ts',
                  },
                },
              },
              allow: [
                { to: { element: { fileInternalPath: 'index.ts' } } },
                { to: { element: { fileInternalPath: 'env.schema.ts' } } },
                { to: { element: { fileInternalPath: 'migration-lock.ts' } } },
                { to: { element: { fileInternalPath: 'connect-timeout.ts' } } },
              ],
              message:
                'infra-barrel-migrate-allowance: src/migrate.ts and its colocated test may reach past a barrel only for the leaves that import nothing — env.schema.ts, migration-lock.ts, connect-timeout.ts.',
            },
            {
              to: { element: { type: 'shared' } },
              disallow: { to: { element: { fileInternalPath: '!index.ts' } } },
              message:
                'shared-barrel: src/shared/<dir> is entered only through its index.ts (north-star §2).',
            },
            {
              // north-star §5 forbids sibling layers as well as frameworks and
              // drivers; `dependency-cruiser`'s `domain-is-pure` covers only
              // the packages, so this half lives here.
              from: { element: { type: 'domain' } },
              disallow: [
                { to: { element: { type: 'application' } } },
                { to: { element: { type: 'module-infrastructure' } } },
              ],
              message:
                'domain-has-no-sibling-layers: domain/** is plain TypeScript and imports no sibling layer (north-star §5).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['**/*.ts'],
    rules: {
      // A Nest module is an empty decorated class by design — the decorator
      // carries the wiring. The rule's own escape hatch is the right fit:
      // a bare empty class is still an error.
      '@typescript-eslint/no-extraneous-class': ['error', { allowWithDecorator: true }],
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'class-validator', message: 'Contracts are Zod only (spec §5.5).' },
            { name: 'class-transformer', message: 'Contracts are Zod only (spec §5.5).' },
            {
              name: '@nestjs/common',
              importNames: ['ValidationError', 'ValidationPipe'],
              message:
                'ValidationError is the AppError subclass in src/shared/errors (spec §5.5b); validation is StandardSchemaValidationPipe, never ValidationPipe.',
            },
            {
              name: '@nestjs/event-emitter',
              message: 'Domain events go through the transactional outbox (spec §5.6).',
            },
            {
              name: '@nestjs/platform-express',
              message: 'The API runs on the Fastify adapter (spec §3).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: '__dirname', message: 'ESM: use import.meta.url (spec §12.1).' },
        { name: '__filename', message: 'ESM: use import.meta.url (spec §12.1).' },
      ],
    },
  },
]
