#!/usr/bin/env bash
# Proves the physical-direction Tailwind ban (spec §7.2) both fires and does
# not over-fire. Run directly; not part of `pnpm check`.
set -uo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
ESLINT="$ROOT/node_modules/.bin/eslint"
[ -x "$ESLINT" ] || { echo "eslint not installed at $ESLINT; run pnpm install" >&2; exit 1; }
TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT
PASS=0
FAIL=0

{
  printf "import { rtlRules } from '%s/packages/config-eslint/rtl.js'\n" "$ROOT"
  printf "export default [{ files: ['**/*.ts'], rules: rtlRules }]\n"
} > "$TMP/eslint.config.js"

check() { # check <clean|flagged> <label> <source>
  local want="$1" label="$2" src="$3" got
  printf '%s\n' "$src" > "$TMP/case.ts"
  # Invoke the binary by path: $TMP lives outside the repo, so `pnpm exec`
  # there cannot resolve eslint and every case would exit non-zero --
  # which reads as "flagged" and makes the negative cases pass by accident.
  if ( cd "$TMP" && "$ESLINT" --no-config-lookup --config eslint.config.js case.ts ) \
       >/dev/null 2>&1; then got=clean; else got=flagged; fi
  if [ "$got" = "$want" ]; then
    echo "  PASS  $label ($got)"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $label (want $want, got $got)"
    FAIL=$((FAIL + 1))
  fi
}

check clean   "logical utilities"          'export const a = "ms-4 me-2 ps-1 pe-3 text-start"'
check flagged "physical margin ml-"        'export const b = "ml-4"'
check flagged "physical text-left"         'export const c = "text-left"'
check flagged "physical inside a template" 'export const d = `flex mr-2`'
check flagged "negative physical -ml-"     'export const e = "-ml-2"'
check flagged "border-l-"                  'export const f = "border-l-2"'
check clean   "small-caps is not ml/pl"    'export const g = "small-caps normal-case"'
check clean   "rtl: variant is allowed"    'export const h = "rtl:rotate-180"'

echo
echo "passed: $PASS   failed: $FAIL"
[ "$FAIL" -eq 0 ]
