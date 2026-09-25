#!/usr/bin/env bash
# Definition-of-done 6 (spec §16). Part of `pnpm check`.
set -uo pipefail
cd "$(dirname "$0")/.." || exit 1
status=0
fail() { echo "check-docs: $*" >&2; status=1; }

# 1. Every manifest entry exists.
while IFS= read -r f; do
  [ -n "$f" ] || continue
  [ -e "$f" ] || fail "missing file: $f"
done < scripts/check-docs.manifest

# 2. Instruction-file line budgets.
if [ -f CLAUDE.md ]; then
  n="$(wc -l < CLAUDE.md | tr -d ' ')"
  [ "$n" -lt 150 ] || fail "CLAUDE.md is $n lines (limit 150)"
fi
for f in apps/*/CLAUDE.md packages/*/CLAUDE.md; do
  [ -f "$f" ] || continue
  n="$(wc -l < "$f" | tr -d ' ')"
  [ "$n" -le 60 ] || fail "$f is $n lines (limit 60)"
done

# 3. Every ADR carries the three MADR headings. The 0000 template is
#    exempt: it is the shape, not a decision.
for f in docs/decisions/[0-9][0-9][0-9][0-9]-*.md; do
  [ -f "$f" ] || continue
  case "$f" in *0000-template.md) continue ;; esac
  for h in "## Context and Problem Statement" "## Considered Options" "## Decision Outcome"; do
    grep -Fq "$h" "$f" || fail "$f missing heading: $h"
  done
done

# 4. Relative markdown links resolve, case-exactly.
link_report="$(python3 scripts/check-links.py 2>&1)"
if [ -n "$link_report" ]; then
  while IFS= read -r line; do
    [ -n "$line" ] && fail "broken or wrong-case link: $line"
  done <<< "$link_report"
fi

# 4b. Config files that exist but have been gutted. The manifest checks
#     presence; this checks that the content still does its job. lefthook.yml
#     was silently reduced to an all-comment document once, and `lefthook
#     validate` reported "All good" because an empty config is vacuously valid.
assert_contains() { # assert_contains <file> <needle>...
  f="$1"; shift
  [ -f "$f" ] || { fail "missing file: $f"; return; }
  for needle in "$@"; do
    # -e: a needle may begin with "--" (a CSS custom property).
    grep -Fq -e "$needle" "$f" || fail "$f no longer contains: $needle"
  done
}
assert_contains lefthook.yml "pre-commit:" "commit-msg:" "pre-push:" \
  "check-commit-msg.sh" "audit:authors" "commitlint"
assert_contains turbo.json '"envMode": "strict"' '"remoteCache"'
assert_contains .gitleaks.toml "useDefault = true"
assert_contains pnpm-workspace.yaml "catalogMode: strict" "minimumReleaseAge"
assert_contains package.json '"packageManager"' '"check:docs"' '"audit:authors"'
assert_contains commitlint.config.mjs "config-conventional" "scope-enum"
assert_contains apps/web/app/globals.css '--color-*: initial' '@custom-variant dark'
assert_contains apps/web/next.config.ts 'cacheComponents: true' 'reactCompiler: true' "output: 'standalone'"
assert_contains packages/config-eslint/next.js 'enforce-logical-properties' 'no-unknown-classes' 'boundaries/dependencies'
assert_contains prettier.config.mjs 'prettier-plugin-tailwindcss'

# 5. Shell files are shellcheck-clean.
if command -v shellcheck >/dev/null 2>&1; then
  shellcheck .claude/hooks/*.sh scripts/*.sh || fail "shellcheck reported problems"
else
  fail "shellcheck is not installed (brew install shellcheck)"
fi

# 6. .mcp.json holds no literal key.
if [ -f .mcp.json ]; then
  # shellcheck disable=SC2016  # ${CONTEXT7_API_KEY} is literal text in the file
  grep -q '\${CONTEXT7_API_KEY}' .mcp.json \
    || fail ".mcp.json must expand the Context7 key from the environment, not hold a literal"
  if grep -Eq '"(ctx7sk|sk)-[A-Za-z0-9_-]{8,}"' .mcp.json; then
    fail ".mcp.json contains what looks like a literal key"
  fi
fi

# 7. .dockerignore and .liaraignore are byte-identical (spec §9.3): Liara
#    reads exactly one ignore file, so drift would ship node_modules.
cmp -s .dockerignore .liaraignore || fail ".dockerignore and .liaraignore differ"

[ "$status" -eq 0 ] && echo "check-docs: OK"
exit "$status"
