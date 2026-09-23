#!/usr/bin/env bash
# Self-check for check-docs.sh. Run directly; not part of `pnpm check`.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
PASS=0
FAIL=0
ok()  { echo "  PASS  $1"; PASS=$((PASS + 1)); }
bad() { echo "  FAIL  $1"; FAIL=$((FAIL + 1)); }
run() { ( cd "$ROOT" && bash scripts/check-docs.sh ) >/dev/null 2>&1; }

if run; then ok "repository passes"; else bad "repository passes"; fi

# Review Focus 4: .dockerignore and .liaraignore must stay byte-identical.
cp "$ROOT/.liaraignore" "$ROOT/.liaraignore.bak"
printf 'drift\n' >> "$ROOT/.liaraignore"
if run; then bad "ignore-file drift caught"; else ok "ignore-file drift caught"; fi
mv "$ROOT/.liaraignore.bak" "$ROOT/.liaraignore"

# Review Focus 3: a wrong-case link resolves on macOS and 404s on Linux CI.
printf '\n[case](North-Star.md)\n' >> "$ROOT/docs/architecture/north-star.md"
if run; then bad "wrong-case link caught"; else ok "wrong-case link caught"; fi
( cd "$ROOT" && git checkout -- docs/architecture/north-star.md )

# A link inside a fenced code block is an example, not a link.
# shellcheck disable=SC2016  # markdown fence, not a shell expansion
printf '\n```markdown\n[example](does-not-exist.md)\n```\n' >> "$ROOT/docs/glossary.md"
if run; then ok "code-fence link ignored"; else bad "code-fence link ignored"; fi
( cd "$ROOT" && git checkout -- docs/glossary.md )

cp "$ROOT/CLAUDE.md" "$ROOT/CLAUDE.md.bak"
for _ in $(seq 1 200); do echo "padding" >> "$ROOT/CLAUDE.md"; done
if run; then bad "over-long CLAUDE.md caught"; else ok "over-long CLAUDE.md caught"; fi
mv "$ROOT/CLAUDE.md.bak" "$ROOT/CLAUDE.md"

cp "$ROOT/.mcp.json" "$ROOT/.mcp.json.bak"
# shellcheck disable=SC2016  # matching the literal ${...} text in the file
sed 's|\${CONTEXT7_API_KEY}|ctx7sk-real-looking-key-000000|' "$ROOT/.mcp.json.bak" > "$ROOT/.mcp.json"
if run; then bad "literal MCP key caught"; else ok "literal MCP key caught"; fi
mv "$ROOT/.mcp.json.bak" "$ROOT/.mcp.json"

cp "$ROOT/docs/decisions/0002-drizzle-over-prisma.md" "$ROOT/adr.bak"
grep -v '^## Considered Options$' "$ROOT/adr.bak" > "$ROOT/docs/decisions/0002-drizzle-over-prisma.md"
if run; then bad "ADR missing a MADR heading caught"; else ok "ADR missing a MADR heading caught"; fi
mv "$ROOT/adr.bak" "$ROOT/docs/decisions/0002-drizzle-over-prisma.md"

echo
echo "passed: $PASS   failed: $FAIL"
[ "$FAIL" -eq 0 ]
