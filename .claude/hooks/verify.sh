#!/usr/bin/env bash
# Stop hook: typecheck and unit tests on what changed. Same command as
# pre-push minus the author audit. Exit 2 with the tail on failure.
set -uo pipefail
payload="$(cat)"
active="$(printf '%s' "$payload" | jq -r '.stop_hook_active // false')"
[ "$active" = "true" ] && exit 0

log="$(mktemp)"
trap 'rm -f "$log"' EXIT
if pnpm turbo run typecheck test --affected --output-logs=errors-only > "$log" 2>&1; then
  exit 0
fi
echo "Verification failed:" >&2
tail -40 "$log" >&2
exit 2
