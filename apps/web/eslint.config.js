// @ts-check
import { fileURLToPath } from 'node:url'
import next from '@ds/config-eslint/next'

// ESLint 10 finds this file from the linted file's directory, but resolves
// relative settings against its own cwd — the repository root under the
// pre-commit hook. Anchoring every path-bearing setting here makes the class
// rules, the boundaries and the Next rules fire the same way from anywhere.
// Rules live in @ds/config-eslint/next; this file adds ignores and anchors only.
const appDir = fileURLToPath(new URL('./', import.meta.url))

/** @type {import('eslint').Linter.Config[]} */
const config = [
  {
    ignores: [
      '.next/**',
      'coverage/**',
      'playwright-report/**',
      'test-results/**',
      'next-env.d.ts',
    ],
  },
  ...next,
  {
    files: ['**/*.ts', '**/*.tsx'],
    settings: {
      // `cwd` is where the plugin resolves `tailwindcss` itself; without it the
      // class rules switch themselves off from the root before reading entryPoint.
      'better-tailwindcss': {
        cwd: appDir,
        entryPoint: fileURLToPath(new URL('./app/globals.css', import.meta.url)),
      },
      'boundaries/root-path': appDir,
      next: { rootDir: appDir },
    },
  },
]

export default config
