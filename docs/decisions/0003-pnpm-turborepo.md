# 0003. pnpm workspaces + Turborepo

- Status: accepted
- Date: 2026-08-27

## Context and Problem Statement

Two apps and five packages share TypeScript configuration, contracts and utilities. They need one dependency graph, one install, and a task runner that understands which packages depend on which.

## Considered Options

- **pnpm workspaces + Turborepo** — isolated `node_modules`, a `catalog:` for pins, a declarative task graph.
- **npm workspaces** — already familiar, but hoists and gives no task graph.
- **Nx** — a task graph plus a large plugin ecosystem and its own conventions.

## Decision Outcome

Chosen: **pnpm + Turborepo**. pnpm's isolated `node_modules` makes an undeclared import fail at resolution rather than working by accident through hoisting, which is the single most valuable property in a repository where agents write the imports. The `catalog:` protocol keeps every version in one file. Turborepo's task graph is a `turbo.json` a person can read in a minute; Nx would add conventions that compete with the ones this spec already fixes.

### Consequences

- Good: An undeclared dependency is a hard error, not a hoisting accident.
- Good: One place to change a version: the workspace catalog.
- Good: `turbo prune --docker` produces a minimal build context for the images.
- Bad: pnpm is a required global install; it is not the default package manager on a fresh machine.
- Bad: `catalogMode: strict` means adding a dependency is two edits, not one.
