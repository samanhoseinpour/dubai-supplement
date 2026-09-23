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

### Consequences

- Good: Branch protection without a paid plan.
- Good: Secret scanning and push protection are available.
- Good: The first push contains no application code, so the public history starts from a reviewed foundation.
- Bad: Any secret committed is public immediately and permanently.
- Bad: Required checks must be added only after they have reported once — a check that has never run blocks every pull request.
