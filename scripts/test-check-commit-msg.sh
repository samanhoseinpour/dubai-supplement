#!/usr/bin/env bash
# Self-check for check-commit-msg.sh. Run directly; not part of `pnpm check`.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PASS=0
FAIL=0

try() { # try <expected-exit> <label> <message lines...>
  local want="$1" label="$2" f got
  shift 2
  f="$(mktemp)"
  printf '%s\n' "$@" > "$f"
  bash "$HERE/check-commit-msg.sh" "$f" >/dev/null 2>&1
  got=$?
  rm -f "$f"
  if [ "$got" -eq "$want" ]; then
    echo "  PASS  $label"
    PASS=$((PASS + 1))
  else
    echo "  FAIL  $label (want $want, got $got)"
    FAIL=$((FAIL + 1))
  fi
}

try 0 "plain conventional message" "feat(api): add brand listing"
try 1 "Co-Authored-By trailer" "feat: x" "" "Co-Authored-By: Claude <noreply@anthropic.com>"
try 1 "lowercase co-authored-by" "feat: x" "" "co-authored-by: someone <a@b.c>"
try 1 "generated with footer" "feat: x" "" "Generated with Claude Code"
try 1 "anthropic noreply address" "feat: x" "" "contact noreply@anthropic.com"
try 1 "message documenting the rule is still rejected" \
      "docs: explain why Co-Authored-By is banned"
try 0 "multi-line UTF-8 Persian body" "feat(web): brand page" "" "صفحه برند اضافه شد"

f="$(mktemp)"; : > "$f"
bash "$HERE/check-commit-msg.sh" "$f" >/dev/null 2>&1
got=$?
rm -f "$f"
if [ "$got" -eq 0 ]; then
  echo "  PASS  empty message does not crash"
  PASS=$((PASS + 1))
else
  echo "  FAIL  empty message does not crash (got $got)"
  FAIL=$((FAIL + 1))
fi

echo
echo "passed: $PASS   failed: $FAIL"
[ "$FAIL" -eq 0 ]
