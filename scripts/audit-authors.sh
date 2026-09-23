#!/usr/bin/env bash
# Every commit author must appear in audit-authors.allowed, and no commit
# message may carry an AI attribution trailer. Spec §13.4.
#
# Author only, never committer: squash merges are committed by
# GitHub <noreply@github.com>, which is not and should not be allowlisted.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ALLOWED="$HERE/audit-authors.allowed"
[ -f "$ALLOWED" ] || { echo "audit-authors: missing $ALLOWED" >&2; exit 1; }

# Pull request: compare against the base branch. Everything else -- a push
# to main, pre-push, a local run -- is every commit reachable from HEAD.
# --all is never used.
if [ -n "${GITHUB_BASE_REF:-}" ]; then
  if ! git rev-parse --verify --quiet "origin/${GITHUB_BASE_REF}" >/dev/null; then
    git fetch --no-tags origin "${GITHUB_BASE_REF}" >/dev/null 2>&1 || true
  fi
  if git rev-parse --verify --quiet "origin/${GITHUB_BASE_REF}" >/dev/null; then
    RANGE="origin/${GITHUB_BASE_REF}..HEAD"
  else
    echo "audit-authors: cannot resolve origin/${GITHUB_BASE_REF};" \
         "ensure actions/checkout uses fetch-depth: 0" >&2
    exit 1
  fi
else
  RANGE="HEAD"
fi

status=0

# 1. Authors.
while IFS= read -r line; do
  [ -n "$line" ] || continue
  if ! grep -Fxq "$line" "$ALLOWED"; then
    echo "audit-authors: disallowed author: $line" >&2
    status=1
  fi
done < <(git log --no-merges --format='%an <%ae>' "$RANGE" | sort -u)

# 2. AI attribution trailers, in every commit including Renovate's.
while IFS= read -r sha; do
  [ -n "$sha" ] || continue
  if git log -1 --format='%B' "$sha" |
     grep -Eiq 'co-authored-by|generated with|claude-session|noreply@anthropic\.com'; then
    echo "audit-authors: AI attribution in $(git log -1 --format='%h %s' "$sha")" >&2
    status=1
  fi
done < <(git log --no-merges --format='%H' "$RANGE")

if [ "$status" -eq 0 ]; then
  n="$(git log --no-merges --oneline "$RANGE" | wc -l | tr -d ' ')"
  echo "audit-authors: OK ($n commits)"
fi
exit "$status"
