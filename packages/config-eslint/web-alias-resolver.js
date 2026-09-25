// @ts-check
import { existsSync, statSync } from 'node:fs'
import { dirname, join, resolve as resolvePath } from 'node:path'

/**
 * Resolves the `@/x` alias — the one shadcn writes and `apps/web/tsconfig.json`
 * maps to `./x` — to a file on disk, for `eslint-plugin-boundaries`.
 *
 * The plugin classifies an import by its resolved path and skips, silently,
 * any import it cannot resolve; an unresolved `@/app/layout` would therefore
 * be a boundary violation that reports nothing (see esm-ts-resolver.js for the
 * same argument). The alias root is the nearest package.json above the
 * importing file, never `process.cwd()`, so the answer does not depend on the
 * directory ESLint was started from.
 *
 * Only `@/` specifiers are claimed; everything else is declined so the Node
 * resolver configured after it answers.
 */
export const interfaceVersion = 2

const EXTENSIONS = ['.ts', '.tsx', '.js', '.jsx']

/** @param {string} file */
function packageRoot(file) {
  let dir = dirname(file)
  while (!existsSync(join(dir, 'package.json'))) {
    const parent = dirname(dir)
    if (parent === dir) return null
    dir = parent
  }
  return dir
}

/**
 * @param {string} source the specifier as written
 * @param {string} file absolute path of the file that wrote it
 * @returns {{ found: boolean, path?: string }}
 */
export function resolve(source, file) {
  if (!source.startsWith('@/')) return { found: false }
  const root = packageRoot(file)
  if (root === null) return { found: false }

  const target = resolvePath(root, source.slice(2))
  const candidates = [
    target,
    ...EXTENSIONS.map((ext) => `${target}${ext}`),
    ...EXTENSIONS.map((ext) => join(target, `index${ext}`)),
  ]
  for (const candidate of candidates) {
    if (existsSync(candidate) && statSync(candidate).isFile())
      return { found: true, path: candidate }
  }
  return { found: false }
}
