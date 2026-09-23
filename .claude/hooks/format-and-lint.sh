#!/usr/bin/env bash
# PostToolUse: format the edited file, and lint it if it is TypeScript.
# Exits 0 for anything it does not handle, so it never blocks an edit.
set -uo pipefail
file="$(jq -r '.tool_input.file_path // ""')"
[ -n "$file" ] || exit 0
[ -f "$file" ] || exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.mjs|*.cjs|*.json|*.md|*.yml|*.yaml|*.css) ;;
  *) exit 0 ;;
esac

pnpm exec prettier --write "$file" >/dev/null 2>&1 || true

case "$file" in
  *.ts|*.tsx) pnpm exec eslint --fix "$file" >/dev/null 2>&1 || true ;;
esac
exit 0
