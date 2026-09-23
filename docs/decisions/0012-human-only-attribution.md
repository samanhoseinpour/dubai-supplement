# 0012. Human-only git attribution, and how it is enforced

- Status: accepted
- Date: 2026-08-27

## Context and Problem Statement

Every contribution must appear as authored solely by Saman Hoseinpour. Tooling that writes `Co-Authored-By` trailers or 'Generated with' footers does so by default, and a public repository makes any slip permanent.

## Considered Options

- **Three enforcement layers** — generator settings, hooks, and a CI audit.
- **Convention only** — document the rule and rely on review.
- **A CI check alone**, with no local guard.

## Decision Outcome

Chosen: **three layers**, because each fails differently. (1) `.claude/settings.json` sets empty attribution so the text is never generated. (2) A `PreToolUse` hook and the lefthook `commit-msg` hook reject it if it appears anyway. (3) `scripts/audit-authors.sh` runs in `pre-push` and in CI, checking the **author** of every non-merge commit against an allowlist — never the committer, since squash merges are committed by `GitHub <noreply@github.com>`. The allowlist holds exactly two identities: Saman's GitHub noreply address and `renovate[bot]`, without which automerged dependency PRs would fail the audit.

One conflict surfaced while implementing this: `.claude/settings.json` denies `Bash(pnpm exec *)`, but lefthook, eslint and commitlint all need it. Rather than widen the deny, a root `prepare: lefthook install` script installs the hooks on `pnpm install`, so the deny stands and nothing needs `pnpm exec` interactively. Git hooks run outside the permission system, so `lefthook.yml` is unaffected.

### Consequences

- Good: The text is never generated, blocked if written, and caught before it can be pushed.
- Good: The audit works on a fresh clone with no `origin/main`, and in a pull request against the base branch.
- Good: Renovate keeps working because it is explicitly allowlisted.
- Bad: The commit-message guard is blunt: a message that merely discusses the banned pattern is also rejected. Describe the rule in `docs/`, not in a commit message.
- Bad: Removing `renovate[bot]` from the allowlist silently breaks every automerged PR.
