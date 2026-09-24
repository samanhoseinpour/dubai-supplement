// @ts-check
import { existsSync } from 'node:fs'
import { dirname, resolve as resolvePath } from 'node:path'

/**
 * Resolves the explicit `.js` specifier an ESM TypeScript project writes back
 * to the `.ts` file it names.
 *
 * `eslint-plugin-boundaries` classifies a dependency by its resolved path and
 * resolves through `eslint-module-utils`, whose default is the Node resolver.
 * That resolver looks for `./infra/db/index.js` on disk, finds nothing and
 * reports the import unresolved — at which point every boundary rule skips it,
 * because an unknown target matches no element. The rules would then report
 * nothing and look green, which is the exact failure this repository is
 * closing, so this is deliberately a resolver and not a rule exemption.
 *
 * Only relative `.js` specifiers are claimed. Everything else — packages,
 * builtins, workspace dependencies — is declined, so the Node resolver
 * configured after it answers instead.
 *
 * When a relative `.js` specifier names neither an existing `.ts` nor an
 * existing `.js`, this declines, the Node resolver fails too, and the boundary
 * rules then **skip that import silently** — the same vacuous-green path
 * described above. That is deliberate and safe here only because the import is
 * already broken: `tsc --noEmit` fails on it in the same `pnpm check`, so
 * nothing reaches a reviewer on the strength of a boundary rule that never
 * ran. Do not extend this resolver to guess at a path it cannot see on disk.
 */
export const interfaceVersion = 2

/**
 * @param {string} source the specifier as written
 * @param {string} file absolute path of the file that wrote it
 * @returns {{ found: boolean, path?: string }}
 */
export function resolve(source, file) {
  if (!source.startsWith('./') && !source.startsWith('../')) return { found: false }
  if (!source.endsWith('.js')) return { found: false }

  const from = dirname(file)
  for (const candidate of [`${source.slice(0, -3)}.ts`, source]) {
    const resolved = resolvePath(from, candidate)
    if (existsSync(resolved)) return { found: true, path: resolved }
  }
  return { found: false }
}
