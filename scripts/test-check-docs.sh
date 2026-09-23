#!/usr/bin/env bash
# Self-check for check-docs.sh. Run directly; not part of `pnpm check`.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
PASS=0
FAIL=0

# This script deliberately breaks the working tree to prove the checker
# notices. Without a trap, a Ctrl-C between a mutation and its restore
# leaves a padded CLAUDE.md, a drifted .liaraignore, a key-shaped string in
# .mcp.json and stray *.bak files behind.
restore() {
  for b in "$ROOT"/CLAUDE.md.bak "$ROOT"/.mcp.json.bak "$ROOT"/.liaraignore.bak \
           "$ROOT"/lefthook.yml.bak "$ROOT"/adr.bak; do
    [ -f "$b" ] || continue
    case "$b" in
      *adr.bak) mv "$b" "$ROOT/docs/decisions/0002-drizzle-over-prisma.md" ;;
      *) mv "$b" "${b%.bak}" ;;
    esac
  done
  git -C "$ROOT" checkout -- docs/architecture/north-star.md docs/glossary.md 2>/dev/null || true
}
trap restore EXIT INT TERM
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
# Built at runtime on purpose: a key-shaped literal committed to a public
# repository would trip gitleaks and is bad hygiene even when it is fake.
fake_key="ctx7sk-$(printf 'a%.0s' $(seq 1 20))"
# shellcheck disable=SC2016  # matching the literal ${...} text in the file
sed "s|\${CONTEXT7_API_KEY}|$fake_key|" "$ROOT/.mcp.json.bak" > "$ROOT/.mcp.json"
if run; then bad "literal MCP key caught"; else ok "literal MCP key caught"; fi
mv "$ROOT/.mcp.json.bak" "$ROOT/.mcp.json"

cp "$ROOT/docs/decisions/0002-drizzle-over-prisma.md" "$ROOT/adr.bak"
grep -v '^## Considered Options$' "$ROOT/adr.bak" > "$ROOT/docs/decisions/0002-drizzle-over-prisma.md"
if run; then bad "ADR missing a MADR heading caught"; else ok "ADR missing a MADR heading caught"; fi
mv "$ROOT/adr.bak" "$ROOT/docs/decisions/0002-drizzle-over-prisma.md"

# C2: every .env form except .env.example must be ignored. A developer
# creating apps/api/.env.production with a real DATABASE_URL and running
# `git add -A` would otherwise publish it to a public repository.
env_ok=1
for f in .env .env.local .env.production .env.development .env.test .env.staging \
         apps/api/.env.production; do
  git -C "$ROOT" check-ignore -q "$f" || { echo "    not ignored: $f"; env_ok=0; }
done
git -C "$ROOT" check-ignore -q .env.example && { echo "    .env.example must stay committable"; env_ok=0; }
if [ "$env_ok" -eq 1 ]; then ok "every .env form ignored, .env.example is not"; else bad "every .env form ignored, .env.example is not"; fi

# I2: the manifest guards existence, but the lefthook regression was a file
# that existed and had been gutted. Assert content, not presence.
cp "$ROOT/lefthook.yml" "$ROOT/lefthook.yml.bak"
{ echo "# gutted"; } > "$ROOT/lefthook.yml"
if run; then bad "gutted lefthook.yml caught"; else ok "gutted lefthook.yml caught"; fi
mv "$ROOT/lefthook.yml.bak" "$ROOT/lefthook.yml"

echo
echo "passed: $PASS   failed: $FAIL"
[ "$FAIL" -eq 0 ]
