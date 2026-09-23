#!/usr/bin/env bash
# PreToolUse guard: block a git commit carrying AI attribution.
# Exit 2 is what blocks the tool call. Spec §13.4 layer 2.
set -euo pipefail
cmd="$(jq -r '.tool_input.command // ""')"
case "$cmd" in
  *git*commit*)
    if printf '%s' "$cmd" |
       grep -Eiq 'co-authored-by|generated with|claude-session|noreply@anthropic\.com'; then
      echo "Blocked: AI attribution. Every commit is authored solely by Saman Hoseinpour." >&2
      exit 2
    fi
    ;;
esac
exit 0
