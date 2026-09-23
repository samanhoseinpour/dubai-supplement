# 0018. One pull request per phase

- Status: accepted
- Date: 2026-09-23

## Context and Problem Statement

§13.1 of the foundation design says the application tasks all live on a single `feat/foundation` branch and merge as one rebase-merge pull request. That was written when nothing had been pushed and the repository was not yet public. Both facts have changed: Phase 1 is merged, `main` is protected by a ruleset with **zero bypass actors**, and the remaining work is three phases — the API skeleton, the storefront, and the containers and deploy.

Taken literally, §13.1 now means one pull request containing `apps/api`, `apps/web`, three shared packages, both Dockerfiles and the Liara configuration, opened weeks from now. It also defers §13.1's own next instruction — promote `check`, `openapi` and `e2e` to required checks "once `ci.yml` is green on `main`" — until that single PR lands, which leaves the ruleset enforcing only `authors` and `secrets` for the entire build.

## Considered Options

- **One `feat/foundation` branch across Phases 2–4**, as §13.1 is written.
- **One pull request per phase** — `feat/api-foundation`, then the storefront, then containers and deploy.
- **One pull request per task**, roughly fifty of them.

## Decision Outcome

Chosen: **one pull request per phase**, each rebase-merged so the TDD history survives.

The argument §13.1 makes for a single PR is that the per-commit history stays intact and every commit is already Saman's. Rebase-merge preserves both regardless of how many pull requests there are, so nothing is given up. What is gained is that CI runs the `check` job against real application code from Phase 2 rather than from Phase 4, and each new required check can be promoted the moment it has reported green on a real pull request — which is the sequence §13.1 asks for and the single-PR reading makes impossible until the end.

Per-task pull requests were rejected: the tasks in a phase share interfaces heavily — config, database, outbox and health are not independently reviewable — and fifty pull requests on a solo project is ceremony, not review.

This supersedes the branching instruction in §13.1 only. Everything else in that section stands: rebase-merge, no direct pushes to `main`, and no application code in the first push.

### Consequences

- Good: The `check` job exercises `apps/api` weeks earlier, so a CI-only failure surfaces while the code that caused it is still fresh.
- Good: Each review package stays a size a reviewer can actually hold. Phase 2 alone is roughly seventeen tasks.
- Good: Required checks get promoted incrementally instead of all at once at the end, when a mistake in the ruleset would block everything.
- Bad: `main` will hold an API with no storefront for a while. Acceptable because nothing is deployed until Phase 4 — there is no user-visible state to be inconsistent.
- Bad: Three review cycles instead of one, and three chances to merge something the next phase has to undo.

**Reversed if** a phase boundary turns out not to be a clean merge point — for example if Phase 3 forces broad edits back into `apps/api`. The remedy is to keep the later phases on one branch and merge them together; nothing about the per-phase PRs already merged would need undoing.
