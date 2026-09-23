#!/usr/bin/env bash
# Reject AI attribution in a commit message. Spec §9.4(2).
#
# Deliberately blunt: a message that merely discusses the pattern is also
# rejected. Describe the rule in docs/, not in a commit message.
set -euo pipefail
msg="${1:?usage: check-commit-msg.sh <path-to-message-file>}"
[ -f "$msg" ] || { echo "check-commit-msg: no such file: $msg" >&2; exit 1; }

if grep -Eiq 'co-authored-by|generated with|claude-session|noreply@anthropic\.com' "$msg"; then
  echo "AI trailer rejected: every commit is authored solely by Saman Hoseinpour." >&2
  exit 1
fi
exit 0
