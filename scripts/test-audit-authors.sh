#!/usr/bin/env bash
# Self-check for audit-authors.sh. Run directly; not part of `pnpm check`.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0
ok()  { echo "  PASS  $1"; PASS=$((PASS + 1)); }
bad() { echo "  FAIL  $1"; FAIL=$((FAIL + 1)); }

make_repo() {
  local d
  d="$(mktemp -d)"
  cd "$d" || exit 1
  git init -q
  git config user.name "Saman Hoseinpour"
  git config user.email "105006550+samanhoseinpour@users.noreply.github.com"
  mkdir -p scripts
  cp "$HERE/audit-authors.sh" "$HERE/audit-authors.allowed" scripts/
  echo x > a.txt
  git add -A
}

run() { bash scripts/audit-authors.sh >/dev/null 2>&1; }

make_repo; git commit -q -m "chore: clean"
if run; then ok "clean commit accepted"; else bad "clean commit accepted"; fi

make_repo
git -c user.name=Someone -c user.email=someone@example.com commit -q -m "chore: other author"
if run; then bad "unknown author rejected"; else ok "unknown author rejected"; fi

make_repo
git commit -q -m "chore: sneaky" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
if run; then bad "co-author trailer rejected"; else ok "co-author trailer rejected"; fi

make_repo; git commit -q -m "chore: no remote"
if run; then ok "works with no origin/main"; else bad "works with no origin/main"; fi

make_repo; git commit -q -m "chore: base"
git checkout -q -b feat
echo y > b.txt; git add -A; git commit -q -m "feat: x"
git checkout -q -
git merge -q --no-ff feat -m "Merge pull request #1" >/dev/null 2>&1
if run; then ok "merge commit ignored"; else bad "merge commit ignored"; fi

echo
echo "passed: $PASS   failed: $FAIL"
[ "$FAIL" -eq 0 ]
