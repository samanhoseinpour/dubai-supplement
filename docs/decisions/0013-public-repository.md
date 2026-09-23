# 0013. A public repository with rulesets on main

- Status: accepted
- Date: 2026-09-23

## Context and Problem Statement

GitHub Free offers branch protection through rulesets on public repositories but not on private ones. This project is a solo effort that wants required status checks on `main` without a paid plan.

## Considered Options

- **Public repository** with a ruleset on `main`.
- **Private repository** with no branch protection on the free plan.
- **Private with GitHub Pro**, paying for protection.

## Decision Outcome

Chosen: **public**, with a ruleset on `main` requiring a pull request and passing checks, and with force-pushes and deletions blocked. The cost is that secrets hygiene becomes mandatory from the first commit, which the repository meets: env files are git-ignored and Read-denied, `.mcp.json` expands its key from the environment, gitleaks runs in CI on every event and over full history weekly, and GitHub push protection is the second net.

Publishing also forced two decisions settled on 2026-09-23. Commits are authored with the GitHub noreply address, and `docs/research/` — which analysed sanctions exposure and Iranian supplement licensing under Saman's name — was moved to a private repository and stripped from history with `git filter-repo` before anything was pushed.

### Outcome, recorded 2026-09-23

The repository went public at `github.com/samanhoseinpour/dubai-supplement`
on 2026-09-23 with 23 commits, 87 files and no application code.

Protection enabled at the same time:

- Ruleset `main`, active: pull request required, force-pushes and deletions
  blocked, merges limited to squash and rebase.
- Required status checks: **`authors` and `secrets` only.** `check` is added
  once it has reported green on `main`; `openapi`, `e2e` and `docker` wait
  for Phases 2-4. A required check that has never reported blocks every pull
  request, which on a solo repository means blocking yourself out of your own
  default branch.
- Secret scanning and push protection: enabled.
- Repository admins retain bypass, per the decision above.

### Consequences

- Good: Branch protection without a paid plan.
- Good: Secret scanning and push protection are available.
- Good: The first push contains no application code, so the public history starts from a reviewed foundation.
- Bad: Any secret committed is public immediately and permanently.
- Bad: Required checks must be added only after they have reported once — a check that has never run blocks every pull request.
