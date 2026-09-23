# Dubai Supplement — Foundation Phase 1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the repository skeleton, toolchain, quality gates, documentation system and agent-development workflow for Dubai Supplement, and push it to GitHub as a public repository with branch protection — containing **no application code**.

**Architecture:** A pnpm 12 workspace driven by Turborepo, with every rule enforced by a tool rather than by prose. Two shared configuration packages (`@ds/config-typescript`, `@ds/config-eslint`) that later apps extend; four shell scripts that gate commits and pushes; a `.claude/` directory that teaches agents the repository's non-negotiables; and a CI workflow whose jobs exist from the first push even though most have nothing to check yet. Phase 1 ends when `pnpm install` succeeds at the root and `main` is protected on GitHub.

**Tech Stack:** pnpm 12.5.1 · Turborepo 2.11.2 · TypeScript 6.0.3 · ESLint 10.11.0 flat config · Prettier 3.9.8 · lefthook 2.1.14 · commitlint 21.2.3 · sherif 1.13.0 · gitleaks · GitHub Actions

**Spec:** `docs/superpowers/specs/2026-08-27-foundation-design.md` (2026-08-27, revised 2026-09-23). Read it alongside this plan — every task argues from a numbered section of it.

## Global Constraints

Copied verbatim from the spec. Every task's requirements implicitly include this section.

- **Human-only authorship.** Every commit is authored by `Saman Hoseinpour <105006550+samanhoseinpour@users.noreply.github.com>`, or by the Renovate GitHub App for dependency bumps only. No `Co-Authored-By` trailers, no "Generated with" footers, no bot or app attribution, ever. (§3, §13.4)
- **Exact pins only.** Every dependency is exact-pinned in the `pnpm-workspace.yaml` `catalog:`; `catalogMode: strict` means a workspace package may not declare a version that is not in the catalog. Never a floating major, never `corepack enable`. (§3, §4.2)
- **TypeScript stays on 6.0.3.** TS 7 is blocked by Renovate. `@nestjs/cli` hard-depends on `typescript: ~6.0.2` and fails fast on 7; `typescript-eslint` peers `>=4.8.4 <6.1.0`. Re-evaluate no earlier than **2026-11-24**. (§3)
- **Node 24.x.** Pinned via `devEngines.runtime` and `.node-version`. No nvm, no corepack. jsdom 30 sets the floor at `^24.15.0`. (§3, §4.2)
- **ESM everywhere**, with explicit `.js` relative specifiers and `import.meta.url` — never `__dirname` or `require`. (§12.1)
- **Persian copy exists only in the storefront.** Everything in this phase — scripts, docs, commit messages, CI output — is English. (§5.5)
- **Nothing is fetched from a foreign host at request time** in production. Not exercised in this phase, but no rule added here may assume otherwise. (§3)
- **One verification command:** `pnpm check`. Every task ends green. (§3, §4.4)
- **Secrets hygiene is mandatory from the first commit** — the repository is public. Only `.env`, `.env.local`, `.env.*.local` may hold real values and all are git-ignored; `.env.example` is committed and never contains a secret. (§9.3, §13.1)

## Review Focus

Five failure modes the spec implies but that no task's happy path would exercise. Each has a test pinned to the task that owns the code.

1. **`--affected` has no base ref on the first push.** Turborepo derives its comparison base from the GitHub Actions event. On the very first push to a brand-new `main` there is no previous commit, and on a shallow clone there is no history to compare. `ci.yml` uses `fetch-depth: 0` for exactly this reason — Task 13 asserts it, and Task 14 verifies the first CI run actually goes green rather than erroring on a missing base.
2. **A required status check that has never reported blocks every PR.** The spec calls this out in §13.1. If `check`, `openapi` or `e2e` were added to the ruleset before they had ever run, `main` would be permanently unmergeable. Task 14 adds **only** `authors` and `secrets` at first-push time and defers the rest to Phase 4.
3. **macOS is case-insensitive; the CI runner is not.** A relative documentation link written as `north-star.md` but stored as `North-Star.md` resolves locally and 404s in CI. `check-docs.sh` (Task 8) compares each link target against the exact name `git ls-files` reports, not against the filesystem's answer.
4. **`.dockerignore` and `.liaraignore` drift apart silently.** §9.3 requires them byte-identical because Liara reads exactly one ignore file. Nothing would notice until a deploy shipped `node_modules`. `check-docs.sh` (Task 8) diffs them and fails if they differ.
5. **The AI-trailer guard is easy to write too loosely or too tightly.** A message legitimately _documenting_ the rule must still be rejected (the guard is a blunt instrument by design, §9.4), but the guard must also survive a multi-line UTF-8 message and must not crash on an empty one. Task 7 tests all three.

---

## File Structure

Everything created in this phase. Nothing under `apps/` exists yet.

| Path                                                             | Responsibility                                                                                  |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `package.json`                                                   | Root scripts (§4.4), `devEngines`, root devDependencies                                         |
| `pnpm-workspace.yaml`                                            | Workspace globs **and every pnpm setting** — the `pnpm` field of package.json is ignored (§4.2) |
| `turbo.json`                                                     | The task graph and `envMode: strict` (§4.2)                                                     |
| `.node-version` · `.editorconfig` · `.gitattributes`             | Editor and runtime pinning                                                                      |
| `.gitignore` · `.dockerignore` · `.liaraignore`                  | Ignore rules; the latter two byte-identical (§9.3)                                              |
| `.gitleaks.toml`                                                 | Secret-scan rules and the `.env.example` allowlist (§10.1)                                      |
| `prettier.config.mjs` · `commitlint.config.mjs` · `lefthook.yml` | Formatting and git hooks (§9.4)                                                                 |
| `packages/config-typescript/`                                    | `base.json` · `nestjs.json` · `nextjs.json` · `library.json` (§4.1)                             |
| `packages/config-eslint/`                                        | Shared flat configs: `base` / `nest` / `next` (§4.1)                                            |
| `scripts/audit-authors.sh` + `.allowed`                          | Attribution enforcement layer 3 (§13.4)                                                         |
| `scripts/check-commit-msg.sh`                                    | Attribution enforcement layer 2 (§9.4)                                                          |
| `scripts/check-docs.sh`                                          | Definition-of-done 6 (§16)                                                                      |
| `docs/architecture/north-star.md`                                | Bounded contexts, invariants, non-goals — the only always-loaded doc (§4.1)                     |
| `docs/glossary.md` · `docs/regulatory.md`                        | Ubiquitous language; enamad/FDA/redenomination facts (§4.1)                                     |
| `docs/decisions/`                                                | `0000-template.md` + ADRs 0002–0017 (§12.4)                                                     |
| `docs/runbooks/`                                                 | `iran-mirrors.md` · `go-live.md` · `first-deploy.md` (§11.4)                                    |
| `CLAUDE.md` · `AGENTS.md` · `README.md` · `.mcp.json`            | Instruction files (§12.1)                                                                       |
| `.claude/rules/*.md`                                             | Path-scoped rules loaded on demand (§12.1)                                                      |
| `.claude/settings.json` · `hooks/` · `agents/` · `skills/`       | Agent configuration (§12.2)                                                                     |
| `.github/workflows/ci.yml` · `deploy.yml`                        | CI and deploy (§10)                                                                             |
| `.github/PULL_REQUEST_TEMPLATE.md` · `renovate.json`             | PR checklist; dependency policy (§9.5, §13.3)                                                   |

---

### Task 1: Root workspace, pnpm catalog and ignore files

Spec: §4.1, §4.2, §9.3. This task is the prerequisite for the NestJS 12 spike in Phase 2 (§5.1), which requires that the root workspace exists and `pnpm install` passes.

**Files:**

- Create: `package.json`, `pnpm-workspace.yaml`, `.node-version`, `.editorconfig`, `.gitattributes`, `.dockerignore`, `.liaraignore`, `.gitleaks.toml`
- Modify: `.gitignore` (currently one line, `.DS_Store`)

**Interfaces:**

- Consumes: nothing.
- Produces: the `catalog:` protocol for every later `package.json`; root scripts `pnpm check`, `pnpm check:docs`, `pnpm audit:authors`, `pnpm lint`, `pnpm format` used by Tasks 5–8 and by CI in Task 13.

- [ ] **Step 1: Write `pnpm-workspace.yaml`**

Every pnpm setting lives here — pnpm ignores the `pnpm` field of `package.json` and warns about it. With `packageManager` pinned, an _unrecognised_ key here is a hard `ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS` error, so key names matter. All names below were verified against pnpm 12.5.1 on 2026-09-23. `allowBuilds` takes a **mapping**, not a list — a list fails with `load configuration ... expected mapping start`, which is a YAML error rather than the unrecognised-key error, so it is easy to mistake for a different problem.

```yaml
packages:
  - 'apps/*'
  - 'packages/*'

catalogMode: strict
minimumReleaseAge: 1440
blockExoticSubdeps: true
forceLegacyDeploy: true
injectWorkspacePackages: false

allowBuilds:
  esbuild: true
  '@swc/core': true
  sharp: true
  lefthook: true

peerDependencyRules:
  allowedVersions:
    '@nest-lab/throttler-storage-redis>@nestjs/common': '12'
    '@nest-lab/throttler-storage-redis>@nestjs/core': '12'

catalog:
  typescript: 6.0.3
  turbo: 2.11.2
  prettier: 3.9.8
  prettier-plugin-tailwindcss: 0.8.1
  eslint: 10.11.0
  typescript-eslint: 8.70.1
  eslint-plugin-boundaries: 7.2.0
  eslint-config-next: 16.3.6
  dependency-cruiser: 18.4.0
  sherif: 1.13.0
  lefthook: 2.1.14
  '@commitlint/cli': 21.2.3
  '@commitlint/config-conventional': 21.2.3
  '@nestjs/common': 12.1.0
  '@nestjs/core': 12.1.0
  '@nestjs/platform-fastify': 12.1.0
  '@nestjs/testing': 12.1.0
  '@nestjs/cli': 12.0.5
  '@nestjs/config': 12.0.1
  '@nestjs/swagger': 12.0.2
  '@nestjs/terminus': 12.1.0
  '@nestjs/throttler': 6.7.0
  '@nest-lab/throttler-storage-redis': 1.2.0
  '@fastify/helmet': 13.1.1
  '@fastify/cookie': 11.1.2
  nestjs-pino: 5.2.0
  pino: 10.3.1
  pino-http: 11.0.0
  zod: 4.6.5
  zod-openapi: 6.0.1
  drizzle-orm: 0.45.3
  drizzle-kit: 0.31.11
  pg: 8.23.0
  ioredis: 5.11.1
  uuid: 14.0.2
  '@aws-sdk/client-s3': 3.1138.0
  next: 16.3.6
  react: 19.3.0
  react-dom: 19.3.0
  babel-plugin-react-compiler: 1.0.0
  tailwindcss: 4.3.3
  '@base-ui/react': 1.8.0
  lucide-react: 1.34.0
  '@persian-tools/persian-tools': 4.0.4
  vite: 8.3.0
  vitest: 5.0.1
  '@vitest/coverage-v8': 5.0.1
  testcontainers: 12.1.0
  '@playwright/test': 1.63.0
  '@axe-core/playwright': 4.13.0
  openapi-typescript: 7.13.0
  openapi-fetch: 0.17.0
```

Two notes for whoever reads this later. `forceLegacyDeploy` is **not** strictly required on pnpm ≥ 12.2.0, which deploys via a dedicated lockfile; it is kept because `Dockerfile.api` (Phase 4) calls `pnpm deploy --legacy` explicitly and determinism beats cleverness. The `@nest-lab/throttler-storage-redis` peer entries are the **only** ones left — `@nestjs/terminus`, `@nestjs/throttler` and `nestjs-pino` all declare Nest 12 peers as of 2026-09-23 (§5.1).

- [ ] **Step 2: Write `package.json`**

Scripts for tasks that have no workspaces yet (`test`, `typecheck`, `boundaries`, …) are defined now and simply no-op until Phases 2–3 add packages that implement them. That is deliberate: CI in Task 13 runs the same command names from the first push.

```json
{
  "name": "dubai-supplement",
  "private": true,
  "type": "module",
  "version": "0.0.0",
  "packageManager": "pnpm@12.5.1",
  "devEngines": {
    "runtime": { "name": "node", "version": "24.x", "onFail": "download" }
  },
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint --output-logs=errors-only",
    "typecheck": "turbo run typecheck --output-logs=errors-only",
    "test": "turbo run test --output-logs=errors-only",
    "test:integration": "turbo run test:integration --output-logs=errors-only",
    "boundaries": "turbo run boundaries --output-logs=errors-only",
    "e2e": "turbo run e2e --output-logs=errors-only",
    "check": "turbo run lint typecheck test test:integration boundaries --output-logs=errors-only && sherif && pnpm check:docs",
    "check:affected": "turbo run lint typecheck test test:integration boundaries --affected --output-logs=errors-only && sherif && pnpm check:docs",
    "check:docs": "bash scripts/check-docs.sh",
    "audit:authors": "bash scripts/audit-authors.sh",
    "format": "prettier --write .",
    "format:check": "prettier --check .",
    "db:up": "docker compose -f infra/compose.yaml up -d --wait",
    "db:down": "docker compose -f infra/compose.yaml down",
    "db:generate": "pnpm --filter api exec drizzle-kit generate",
    "db:migrate": "pnpm --filter api exec tsx src/migrate.ts",
    "db:seed": "turbo run seed --filter=api --output-logs=errors-only",
    "openapi:generate": "turbo run generate --filter=@ds/api-client"
  },
  "devDependencies": {
    "@commitlint/cli": "catalog:",
    "@commitlint/config-conventional": "catalog:",
    "eslint": "catalog:",
    "lefthook": "catalog:",
    "prettier": "catalog:",
    "sherif": "catalog:",
    "turbo": "catalog:",
    "typescript": "catalog:"
  }
}
```

- [ ] **Step 3: Write the runtime and editor pins**

`.node-version`:

```
24.21.0
```

`.editorconfig`:

```ini
root = true

[*]
charset = utf-8
end_of_line = lf
indent_style = space
indent_size = 2
insert_final_newline = true
trim_trailing_whitespace = true

[*.md]
trim_trailing_whitespace = false
```

`.gitattributes` — the last line keeps the lockfile out of diffs and stops merge tools mangling it:

```
* text=auto eol=lf
*.sh text eol=lf
pnpm-lock.yaml -diff -merge linguist-generated=true
```

- [ ] **Step 4: Write the three ignore files**

`.gitignore` (replacing the single `.DS_Store` line):

```
.DS_Store
node_modules/
dist/
.next/
coverage/
.turbo/
*.tsbuildinfo
**/.env
**/.env.local
**/.env.*.local
.claude/settings.local.json
playwright-report/
test-results/
.vitest/
```

`.dockerignore` **and** `.liaraignore` — byte-identical, per §9.3, because Liara reads exactly one ignore file and `.dockerignore` sits in its default-ignored list. Task 8 enforces the identity.

```
node_modules
.next
dist
coverage
docs
.git
.claude/settings.local.json
**/.env
**/.env.local
**/.env.*.local
```

- [ ] **Step 5: Write `.gitleaks.toml`**

Extends the stock rules with a generic high-entropy assignment rule, and allowlists `.env.example` so the committed placeholder file never trips the scan (§10.1).

```toml
[extend]
useDefault = true

[[rules]]
id = "generic-assigned-secret"
description = "High-entropy value assigned to a *_TOKEN / *_SECRET / *_KEY name"
regex = '''(?i)\b[A-Z0-9_]*(TOKEN|SECRET|KEY)\s*[=:]\s*['"]?([A-Za-z0-9+/_\-]{24,})['"]?'''
entropy = 3.5
secretGroup = 2

[rules.allowlist]
paths = ['''\.env\.example$''']

[allowlist]
description = "Committed placeholder files never hold real values"
paths = ['''\.env\.example$''', '''pnpm-lock\.yaml$''']
```

- [ ] **Step 6: Verify the workspace resolves**

Run: `pnpm install`

Expected: completes without `ERR_PNPM_UNRECOGNIZED_WORKSPACE_SETTINGS`, writes `pnpm-lock.yaml`, creates `node_modules/.pnpm`. If an unrecognised-settings error appears, a key name in Step 1 is wrong for this pnpm version — check it against <https://pnpm.io/settings> rather than deleting it.

Then confirm the lockfile is reproducible:

Run: `pnpm install --frozen-lockfile`

Expected: `Lockfile is up to date, resolution step is skipped`.

- [ ] **Step 7: Verify the ignore files are byte-identical**

Run: `diff .dockerignore .liaraignore && echo IDENTICAL`

Expected: `IDENTICAL`, no diff output.

> **Ordering note.** `pnpm check` cannot run yet — it calls `pnpm check:docs`, whose script arrives in Task 14. Until then use the narrower commands each task names (`pnpm lint`, `pnpm format:check`). Task 14 Step 6 is the first `pnpm check`.

- [ ] **Step 8: Commit**

```bash
git add package.json pnpm-workspace.yaml pnpm-lock.yaml .node-version \
        .editorconfig .gitattributes .gitignore .dockerignore .liaraignore .gitleaks.toml
git commit -m "chore: add root workspace, pnpm catalog and ignore files"
```

---

### Task 2: Turborepo task graph

Spec: §4.2 (Task runner row), §4.4. Defines every task name the rest of the repository will implement, so later phases add workspaces rather than edit this file.

**Files:**

- Create: `turbo.json`

**Interfaces:**

- Consumes: the root scripts from Task 1.
- Produces: task ids `build`, `dev`, `lint`, `typecheck`, `test`, `test:integration`, `boundaries`, `e2e`, plus `api#openapi`, `api#seed` and `@ds/api-client#generate` that Phases 2–3 attach scripts to.

- [ ] **Step 1: Write `turbo.json`**

`envMode: strict` means a task sees only the variables declared for it. Machine-level Docker and Testcontainers variables go through `globalPassThroughEnv`, never `env` (§9.3). `test:integration` and `e2e` are uncacheable because they touch live services.

```json
{
  "$schema": "https://turborepo.dev/schema.json",
  "envMode": "strict",
  "globalPassThroughEnv": ["TESTCONTAINERS_*", "DOCKER_HOST"],
  "globalDependencies": ["pnpm-workspace.yaml", ".node-version"],
  "remoteCache": { "enabled": false },
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", "!.next/cache/**", "*.tsbuildinfo"]
    },
    "dev": { "dependsOn": ["^build"], "persistent": true, "cache": false },
    "lint": { "dependsOn": ["^build"] },
    "typecheck": { "dependsOn": ["^build"] },
    "test": { "dependsOn": ["^build"] },
    "test:integration": { "dependsOn": ["^build"], "cache": false },
    "boundaries": { "dependsOn": ["^build"] },
    "e2e": { "dependsOn": ["^build"], "cache": false },
    "api#openapi": { "dependsOn": ["build"], "outputs": ["openapi.json"] },
    "api#seed": { "dependsOn": ["build"], "cache": false },
    "@ds/api-client#generate": {
      "dependsOn": ["api#openapi"],
      "outputs": ["src/generated/**"]
    }
  }
}
```

- [ ] **Step 2: Verify turbo parses it and finds no tasks yet**

Run: `pnpm lint`

Expected: exit 0. Turbo reports no packages in scope — there are no workspaces yet. An exit code other than 0, or a schema error, means the file is malformed.

- [ ] **Step 3: Verify `--affected` does not error without a base**

This is Review Focus item 1, checked locally before CI depends on it.

Run: `pnpm turbo run lint --affected --output-logs=errors-only`

Expected: exit 0. Turbo falls back to running everything in scope (which is nothing) rather than failing on a missing comparison base.

- [ ] **Step 4: Commit**

```bash
git add turbo.json
git commit -m "chore: add turborepo task graph"
```

---

### Task 3: `@ds/config-typescript`

Spec: §4.1, §4.2 ("tsconfigs written TS-7-clean — no `baseUrl`, no `paths`"). Four bases that every later workspace extends, so the eventual TypeScript 7 move is mechanical rather than archaeological.

**Files:**

- Create: `packages/config-typescript/package.json`, `base.json`, `nestjs.json`, `nextjs.json`, `library.json`

**Interfaces:**

- Consumes: the `catalog:` from Task 1.
- Produces: `@ds/config-typescript/base.json`, `/nestjs.json`, `/nextjs.json`, `/library.json` — referenced by `apps/api` (Phase 2), `apps/web` (Phase 3) and the three compiled packages.

- [ ] **Step 1: Write `packages/config-typescript/package.json`**

A files-only package: no build, no main, just JSON served through an exports map.

```json
{
  "name": "@ds/config-typescript",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./base.json": "./base.json",
    "./nestjs.json": "./nestjs.json",
    "./nextjs.json": "./nextjs.json",
    "./library.json": "./library.json"
  }
}
```

- [ ] **Step 2: Write `base.json`**

No `baseUrl` and no `paths` — that is the TS-7-clean requirement. Module resolution is `nodenext` because the API consumes compiled ESM.

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "forceConsistentCasingInFileNames": true,
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "declaration": true,
    "sourceMap": true,
    "newLine": "lf"
  },
  "exclude": ["node_modules", "dist", ".next", "coverage"]
}
```

- [ ] **Step 3: Write `nestjs.json`**

Two deliberate departures from `base.json`, both load-bearing:

`verbatimModuleSyntax` is turned **off**. With it on, TypeScript preserves `import type` exactly — and a constructor parameter whose class arrives via a type-only import emits no `design:paramtypes` entry, so Nest's dependency injection silently resolves `undefined`. This is the single most common way an ESM NestJS project breaks, and it fails at runtime rather than at build.

`emitDecoratorMetadata` is what the whole DI system reads.

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "experimentalDecorators": true,
    "emitDecoratorMetadata": true,
    "verbatimModuleSyntax": false,
    "outDir": "dist",
    "rootDir": "src",
    "types": ["node"]
  }
}
```

- [ ] **Step 4: Write `nextjs.json`**

Next.js resolves through its own bundler, so `module`/`moduleResolution` differ from the base, and `noEmit` is set because `next build` owns emission.

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "lib": ["ES2023", "DOM", "DOM.Iterable"],
    "module": "esnext",
    "moduleResolution": "bundler",
    "jsx": "preserve",
    "noEmit": true,
    "allowJs": true,
    "incremental": true,
    "plugins": [{ "name": "next" }]
  }
}
```

- [ ] **Step 5: Write `library.json`**

For the three compiled packages (`@ds/contracts`, `@ds/persian`, `@ds/api-client`), which build with `tsc -b`. `composite` and `declarationMap` are what make project references and go-to-definition work across the workspace.

```json
{
  "$schema": "https://json.schemastore.org/tsconfig",
  "extends": "./base.json",
  "compilerOptions": {
    "composite": true,
    "declaration": true,
    "declarationMap": true,
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

- [ ] **Step 6: Verify each config is valid JSON and actually resolves**

Run:

```bash
pnpm install
node -e "for (const f of ['base','nestjs','nextjs','library']) { JSON.parse(require('fs').readFileSync('packages/config-typescript/'+f+'.json','utf8')); console.log('ok', f); }"
```

Expected: `ok base` / `ok nestjs` / `ok nextjs` / `ok library`.

Then prove `extends` resolves through the exports map, which is the part that silently breaks:

```bash
mkdir -p /tmp/tscheck && cd /tmp/tscheck
printf '{"extends":"@ds/config-typescript/nestjs.json","compilerOptions":{"rootDir":"."},"files":[]}\n' > tsconfig.json
ln -sfn "$OLDPWD/node_modules" node_modules
pnpm exec tsc --showConfig -p tsconfig.json | head -20
cd "$OLDPWD" && rm -rf /tmp/tscheck
```

Expected: the printed config shows `"emitDecoratorMetadata": true` and `"verbatimModuleSyntax": false`. If `tsc` reports `File '@ds/config-typescript/nestjs.json' not found`, the exports map in Step 1 is wrong.

- [ ] **Step 7: Commit**

```bash
git add packages/config-typescript pnpm-lock.yaml
git commit -m "chore(config): add shared TypeScript configs"
```

---

### Task 4: `@ds/config-eslint`

Spec: §4.1, §4.2, §4.3(5), §7.2. Three flat configs. The `no-restricted-imports` and `no-restricted-syntax` rules here are how several of the spec's prose rules become machine-enforced.

**Files:**

- Create: `packages/config-eslint/package.json`, `base.js`, `nest.js`, `next.js`, `rtl.js`
- Create: `eslint.config.js` (repository root)

**Interfaces:**

- Consumes: `@ds/config-typescript` (Task 3) for the type-aware parser project service.
- Produces: `@ds/config-eslint/base`, `/nest`, `/next` — consumed by `apps/api`, `apps/web` and the packages.

- [ ] **Step 1: Write `packages/config-eslint/package.json`**

```json
{
  "name": "@ds/config-eslint",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "exports": {
    "./base": "./base.js",
    "./nest": "./nest.js",
    "./next": "./next.js"
  },
  "dependencies": {
    "typescript-eslint": "catalog:",
    "eslint-plugin-boundaries": "catalog:"
  }
}
```

- [ ] **Step 2: Write `base.js`**

```js
// @ts-check
import tseslint from 'typescript-eslint'

export default tseslint.config(
  { ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/*.tsbuildinfo'] },
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: process.cwd() },
    },
    rules: {
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    ...tseslint.configs.disableTypeChecked,
  },
)
```

- [ ] **Step 3: Write `nest.js`**

Each banned import maps to a spec rule: `class-validator`/`class-transformer` because contracts are Zod only (§5.5); `@nestjs/event-emitter` because events go through the transactional outbox (§5.6); `@nestjs/platform-express` because the adapter is Fastify (§3).

```js
// @ts-check
import base from './base.js'

export default [
  ...base,
  {
    files: ['**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            { name: 'class-validator', message: 'Contracts are Zod only (spec §5.5).' },
            { name: 'class-transformer', message: 'Contracts are Zod only (spec §5.5).' },
            {
              name: '@nestjs/event-emitter',
              message: 'Domain events go through the transactional outbox (spec §5.6).',
            },
            {
              name: '@nestjs/platform-express',
              message: 'The API runs on the Fastify adapter (spec §3).',
            },
          ],
        },
      ],
      'no-restricted-globals': [
        'error',
        { name: '__dirname', message: 'ESM: use import.meta.url (spec §12.1).' },
        { name: '__filename', message: 'ESM: use import.meta.url (spec §12.1).' },
      ],
    },
  },
]
```

- [ ] **Step 4: Write `next.js`**

The `no-restricted-syntax` selector is how §7.2's "logical utilities only" rule stops being prose. It matches physical-direction Tailwind classes in any string literal or JSX attribute.

```js
// @ts-check
import base from './base.js'

const PHYSICAL_TAILWIND = String.raw`/(^|\s)-?(ml|mr|pl|pr|left|right|border-l|border-r|rounded-l|rounded-r)-|(^|\s)text-(left|right)(\s|$)/`

export default [
  ...base,
  {
    files: ['**/*.ts', '**/*.tsx'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: 'next/font/google',
              message: 'Vazirmatn is vendored and loaded with next/font/local (spec §7.2).',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: `Literal[value=${PHYSICAL_TAILWIND}]`,
          message:
            'RTL: use logical utilities (ms- me- ps- pe- start- end- text-start) — spec §7.2.',
        },
        {
          selector: `TemplateElement[value.raw=${PHYSICAL_TAILWIND}]`,
          message:
            'RTL: use logical utilities (ms- me- ps- pe- start- end- text-start) — spec §7.2.',
        },
      ],
    },
  },
]
```

- [ ] **Step 5: Write the root `eslint.config.js`**

Phase 1 has no TypeScript source, so the root config lints only the config files themselves. Phases 2–3 add per-workspace configs.

```js
// @ts-check
import base from '@ds/config-eslint/base'

export default [
  { ignores: ['**/dist/**', '**/.next/**', '**/coverage/**', '**/node_modules/**'] },
  ...base,
]
```

Add `@ds/config-eslint` to the root `package.json` `devDependencies` as `"workspace:*"`, then re-run `pnpm install`.

- [ ] **Step 6: Verify the physical-class rule actually fires**

This is the rule most likely to be written wrong, so prove it both ways before trusting it.

```bash
mkdir -p /tmp/rtlcheck
printf 'export const a = "ms-4 text-start"\n' > /tmp/rtlcheck/good.ts
printf 'export const b = "ml-4 text-left"\n'  > /tmp/rtlcheck/bad.ts
"$ROOT/node_modules/.bin/eslint" --no-config-lookup --config packages/config-eslint/next.js /tmp/rtlcheck/good.ts
echo "good exit: $?"
"$ROOT/node_modules/.bin/eslint" --no-config-lookup --config packages/config-eslint/next.js /tmp/rtlcheck/bad.ts
echo "bad exit: $?"
rm -rf /tmp/rtlcheck
```

Expected: `good exit: 0`, and `bad exit: 1` with the message "RTL: use logical utilities". If `bad exit` is 0 the regex in Step 4 is not matching — fix it before moving on, because nothing downstream will catch it.

- [ ] **Step 7: Verify the repository lints clean**

Run: `pnpm lint`

Expected: exit 0, no errors.

> **`eslint-plugin-boundaries` is installed but not configured here.** §4.3(5) uses it to enforce module boundaries _inside_ `apps/api` and `apps/web`, neither of which exists yet; its rules are written in Phases 2 and 3 alongside `apps/api/.dependency-cruiser.cjs`. Declaring the dependency now keeps the catalog pin in one place.

- [ ] **Step 8: Commit**

```bash
git add packages/config-eslint eslint.config.js package.json pnpm-lock.yaml
git commit -m "chore(config): add shared ESLint flat configs"
```

---

### Task 5: Prettier

Spec: §4.2, §9.4(1). Formatting is a PostToolUse hook and a pre-commit hook, so it has to be deterministic and fast.

**Files:**

- Create: `prettier.config.mjs`, `.prettierignore`

**Interfaces:**

- Consumes: nothing.
- Produces: `pnpm format` / `pnpm format:check`, used by the lefthook `pre-commit` hook (Task 7) and the `.claude/hooks/format-and-lint.sh` hook (Task 14).

- [ ] **Step 1: Write `prettier.config.mjs`**

The Tailwind plugin is declared now but only does work once `apps/web` exists; listing it here keeps one source of formatting truth.

```js
/** @type {import("prettier").Config} */
export default {
  semi: false,
  singleQuote: true,
  trailingComma: 'all',
  printWidth: 100,
  overrides: [{ files: '*.md', options: { proseWrap: 'preserve' } }],
}
```

**`prettier-plugin-tailwindcss` is deliberately not enabled yet.** It sorts classes against a stylesheet (`tailwindStylesheet: './apps/web/app/globals.css'` under Tailwind v4), and that file does not exist until Phase 3. Enabling it now means every format run warns about a missing stylesheet. It is pinned in the catalog at `0.8.1` and added to this config in Phase 3, together with `apps/web`.

- [ ] **Step 2: Write `.prettierignore`**

```
pnpm-lock.yaml
dist
.next
coverage
.turbo
**/src/generated
**/openapi.json
```

- [ ] **Step 3: Format the repository and verify idempotence**

Run: `pnpm format && pnpm format:check`

Expected: the second command prints `All matched files use Prettier code style!`. If `format:check` fails immediately after `format`, a plugin is rewriting non-deterministically — resolve before adding the commit hook that depends on it.

- [ ] **Step 4: Commit**

```bash
git add prettier.config.mjs .prettierignore package.json pnpm-lock.yaml
git add -u
git commit -m "chore: add prettier configuration"
```

---

### Task 6: `audit-authors.sh` — attribution enforcement, layer 3

Spec: §13.4, §16 DoD 7. Layers 1 and 2 (Claude Code settings, hooks) can be bypassed; this one runs in CI and cannot. It checks the **author** only, never the committer, because squash merges are committed by `GitHub <noreply@github.com>`.

**Files:**

- Create: `scripts/audit-authors.sh`, `scripts/audit-authors.allowed`

**Interfaces:**

- Consumes: nothing.
- Produces: `pnpm audit:authors` (exit 0 clean / exit 1 with the offending commits), used by the lefthook `pre-push` hook (Task 7) and the CI `authors` job (Task 13).

- [ ] **Step 1: Write `scripts/audit-authors.allowed`**

Exactly two identities. The Renovate line is what makes automerged dependency PRs possible (§9.5); without it, every bot commit would fail the audit.

```
Saman Hoseinpour <105006550+samanhoseinpour@users.noreply.github.com>
renovate[bot] <29139614+renovate[bot]@users.noreply.github.com>
```

- [ ] **Step 2: Write the failing test**

Write `scripts/test-audit-authors.sh`. It builds throwaway repositories in a temp directory and asserts the script's exit code, so it never depends on this repository's real history.

```bash
#!/usr/bin/env bash
# Self-check for audit-authors.sh. Run directly; not part of `pnpm check`.
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PASS=0; FAIL=0
ok()   { echo "  PASS  $1"; PASS=$((PASS+1)); }
bad()  { echo "  FAIL  $1"; FAIL=$((FAIL+1)); }

make_repo() {
  d="$(mktemp -d)"; cd "$d" || exit 1
  git init -q; git config user.name "Saman Hoseinpour"
  git config user.email "105006550+samanhoseinpour@users.noreply.github.com"
  mkdir -p scripts
  cp "$HERE/audit-authors.sh" "$HERE/audit-authors.allowed" scripts/
  echo x > a.txt; git add -A
  echo "$d"
}

# 1. A clean commit by the allowed author passes.
d=$(make_repo); git commit -q -m "chore: clean"
bash scripts/audit-authors.sh >/dev/null 2>&1 \
  && ok "clean commit accepted" || bad "clean commit accepted"

# 2. An unknown author is rejected.
d=$(make_repo); git -c user.name=Someone -c user.email=someone@example.com \
  commit -q -m "chore: other author"
bash scripts/audit-authors.sh >/dev/null 2>&1 \
  && bad "unknown author rejected" || ok "unknown author rejected"

# 3. A Co-Authored-By trailer is rejected even from the allowed author.
d=$(make_repo)
git commit -q -m "chore: sneaky" -m "Co-Authored-By: Claude <noreply@anthropic.com>"
bash scripts/audit-authors.sh >/dev/null 2>&1 \
  && bad "co-author trailer rejected" || ok "co-author trailer rejected"

# 4. Review Focus 5: runs without origin/main present (a fresh local repo).
d=$(make_repo); git commit -q -m "chore: no remote"
bash scripts/audit-authors.sh >/dev/null 2>&1 \
  && ok "works with no origin/main" || bad "works with no origin/main"

# 5. A merge commit by GitHub is ignored (author-only, --no-merges).
d=$(make_repo); git commit -q -m "chore: base"
git checkout -q -b feat; echo y > b.txt; git add -A; git commit -q -m "feat: x"
git checkout -q -; git merge -q --no-ff feat \
  -m "Merge pull request #1" --author="GitHub <noreply@github.com>"
bash scripts/audit-authors.sh >/dev/null 2>&1 \
  && ok "merge commit ignored" || bad "merge commit ignored"

echo; echo "passed: $PASS   failed: $FAIL"
[ "$FAIL" -eq 0 ]
```

- [ ] **Step 3: Run it to make sure it fails**

Run: `bash scripts/test-audit-authors.sh`

Expected: every case FAILs — `scripts/audit-authors.sh` does not exist yet.

- [ ] **Step 4: Write `scripts/audit-authors.sh`**

```bash
#!/usr/bin/env bash
# Every commit author must appear in audit-authors.allowed, and no commit
# message may carry an AI attribution trailer. Spec §13.4.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
ALLOWED="$HERE/audit-authors.allowed"
[ -f "$ALLOWED" ] || { echo "audit-authors: missing $ALLOWED" >&2; exit 1; }

# Pull request: compare against the base branch. Everything else (a push to
# main, pre-push, a local run): every commit reachable from HEAD.
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

# 1. Authors. Author only, never committer.
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
  echo "audit-authors: OK ($(git log --no-merges --oneline "$RANGE" | wc -l | tr -d ' ') commits)"
fi
exit "$status"
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `chmod +x scripts/audit-authors.sh scripts/test-audit-authors.sh && bash scripts/test-audit-authors.sh`

Expected: `passed: 5   failed: 0`.

- [ ] **Step 6: Run it against this repository's real history**

Run: `pnpm audit:authors`

Expected: `audit-authors: OK (N commits)`. If it reports a disallowed author, the history rewrite done on 2026-09-23 missed a commit — stop and re-check before pushing anything.

- [ ] **Step 7: Commit**

```bash
git add scripts/audit-authors.sh scripts/audit-authors.allowed scripts/test-audit-authors.sh
git commit -m "chore: add author audit script"
```

---

### Task 7: commitlint, the AI-trailer guard, and lefthook

Spec: §9.4(2)(3), §13.3. Layer 2 of attribution enforcement plus conventional-commit titles.

**Files:**

- Create: `commitlint.config.mjs`, `scripts/check-commit-msg.sh`, `lefthook.yml`

**Interfaces:**

- Consumes: `pnpm audit:authors` (Task 6), `prettier` (Task 5), `eslint` (Task 4).
- Produces: installed git hooks — `pre-commit`, `commit-msg`, `pre-push`.

- [ ] **Step 1: Write the failing test**

`scripts/test-check-commit-msg.sh`. This covers Review Focus item 5 — the guard must reject a message that merely _mentions_ the pattern (it is blunt by design), survive multi-line UTF-8, and not crash on an empty file.

```bash
#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
PASS=0; FAIL=0
try() { # try <expected-exit> <label> <message...>
  want="$1"; label="$2"; shift 2
  f="$(mktemp)"; printf '%s\n' "$@" > "$f"
  bash "$HERE/check-commit-msg.sh" "$f" >/dev/null 2>&1; got=$?
  rm -f "$f"
  if [ "$got" -eq "$want" ]; then echo "  PASS  $label"; PASS=$((PASS+1))
  else echo "  FAIL  $label (want $want, got $got)"; FAIL=$((FAIL+1)); fi
}

try 0 "plain conventional message" "feat(api): add brand listing"
try 1 "Co-Authored-By trailer" "feat: x" "" "Co-Authored-By: Claude <noreply@anthropic.com>"
try 1 "lowercase co-authored-by" "feat: x" "" "co-authored-by: someone <a@b.c>"
try 1 "generated with footer" "feat: x" "" "Generated with Claude Code"
try 1 "anthropic noreply address" "feat: x" "" "someone@noreply@anthropic.com"
try 1 "message documenting the rule is still rejected" \
      "docs: explain why Co-Authored-By is banned"
try 0 "multi-line UTF-8 Persian body" "feat(web): brand page" "" "صفحه برند اضافه شد"

# Empty file must not crash.
f="$(mktemp)"; : > "$f"
bash "$HERE/check-commit-msg.sh" "$f" >/dev/null 2>&1; got=$?
rm -f "$f"
if [ "$got" -eq 0 ]; then echo "  PASS  empty message does not crash"; PASS=$((PASS+1))
else echo "  FAIL  empty message does not crash (got $got)"; FAIL=$((FAIL+1)); fi

echo; echo "passed: $PASS   failed: $FAIL"
[ "$FAIL" -eq 0 ]
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `bash scripts/test-check-commit-msg.sh`

Expected: failures — the script does not exist.

- [ ] **Step 3: Write `scripts/check-commit-msg.sh`**

```bash
#!/usr/bin/env bash
# Reject AI attribution in a commit message. Spec §9.4(2).
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
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `chmod +x scripts/check-commit-msg.sh scripts/test-check-commit-msg.sh && bash scripts/test-check-commit-msg.sh`

Expected: `passed: 8   failed: 0`.

- [ ] **Step 5: Write `commitlint.config.mjs`**

Scopes are exactly the ones §4.1 names, so a typo'd scope fails rather than silently creating a new one.

```js
/** @type {import('@commitlint/types').UserConfig} */
export default {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'scope-enum': [
      2,
      'always',
      ['api', 'web', 'contracts', 'api-client', 'persian', 'config', 'docs', 'infra', 'ci', 'deps'],
    ],
    'body-max-line-length': [0],
  },
}
```

- [ ] **Step 6: Write `lefthook.yml`**

Note `pre-push` runs unit tests only — no Docker on the push path (§9.4(3)).

```yaml
pre-commit:
  parallel: true
  jobs:
    - name: prettier
      glob: '*.{ts,tsx,js,mjs,cjs,json,md,yml,yaml,css}'
      run: pnpm exec prettier --write {staged_files}
      stage_fixed: true
    - name: eslint
      glob: '*.{ts,tsx}'
      run: pnpm exec eslint --fix {staged_files}
      stage_fixed: true

commit-msg:
  jobs:
    - name: commitlint
      run: pnpm exec commitlint --edit {1}
    - name: no-ai-trailers
      run: bash scripts/check-commit-msg.sh {1}

pre-push:
  jobs:
    - name: audit-authors
      run: pnpm audit:authors
    - name: typecheck-and-unit-tests
      run: pnpm turbo run typecheck test --affected --output-logs=errors-only
```

- [ ] **Step 7: Install the hooks and verify all three fire**

```bash
pnpm exec lefthook install
git commit --allow-empty -m "bad message with no type"      # expect commitlint to reject
git commit --allow-empty -m "chore: ok" -m "Co-Authored-By: X <x@y.z>"  # expect guard to reject
git commit --allow-empty -m "chore: verify hooks"           # expect success
git reset --soft HEAD~1 && git reset                        # NOT --hard
```

> **Never use `git reset --hard` here.** It discards working-tree changes as
> well as the commit. During execution it silently reverted `lefthook.yml` to
> the version already committed, leaving the hooks installed but configured
> with nothing — so they ran, printed their banner, and enforced no rule at
> all. `--soft` followed by a plain `reset` removes the commit and keeps the
> tree.

Expected: the first two commits are rejected with a non-zero exit, the third succeeds. This is spec §16 DoD 6's "a test commit containing `Co-Authored-By:` is rejected locally".

- [ ] **Step 8: Commit**

```bash
git add commitlint.config.mjs lefthook.yml scripts/check-commit-msg.sh scripts/test-check-commit-msg.sh
git commit -m "chore: add commitlint, AI-trailer guard and git hooks"
```

---

### Task 8: Architecture docs — north star, glossary, regulatory, ADR template

Spec: §4.1, §5.4, §12.3, §12.4. `north-star.md` is the only always-loaded document, so it carries the invariants that every future spec is checked against.

**Files:**

- Create: `docs/architecture/north-star.md`, `docs/glossary.md`, `docs/regulatory.md`, `docs/decisions/0000-template.md`

**Interfaces:**

- Consumes: nothing.
- Produces: `docs/architecture/north-star.md`, imported by `CLAUDE.md` (Task 11); `docs/decisions/0000-template.md`, used by the `adr` skill (Task 13) and by Task 9.

- [ ] **Step 1: Write `docs/architecture/north-star.md`**

Five required sections, in this order. Content is transcribed from the spec, not invented:

1. **Bounded contexts** — the full table from §5.4 (health, catalog, inventory, cart, checkout, orders, shipping, customers, identity, promotions, reviews, wishlist, notifications, audit, media, payments), each with its responsibility and whether it is built yet.
2. **Dependency directions** — the five rules from §4.3 and the five `dependency-cruiser` rules from §5.3, stated as prose an agent can check itself against.
3. **Invariants** — verbatim from §5.4: only variants are sellable; checkout is the only module allowed to orchestrate across contexts and every other module reacts to events; money is IRR minor units; cross-context data access goes through public services or events, never through another module's tables.
4. **Non-goals** — from §17, plus the four permanent ones from §2: no marketplace/multi-seller (D2), no i18n (D3), no online payment at launch (D4), no foreign hosting in the production path (D1).
5. **Deferred designs** — the authentication design from §5.8 (phone OTP, hashed single-use codes, JWT in an `httpOnly; Secure; SameSite=Lax` cookie with **no `Domain`** attribute, opaque rotating refresh token stored hashed, `RolesGuard`), recorded here because the identity spec will implement it and nothing else records it.

Add a line under the title citing the research by title and date — the documents themselves live outside this repository (spec §19.2):

```markdown
> Background: "Dubai Supplement — Foundation Research", 2026-08-27, and
> "Liara deployment verification", 2026-08-27. Both are held privately,
> outside this repository.
```

- [ ] **Step 2: Write `docs/glossary.md`**

A two-column Persian ↔ English table, seeded with exactly the terms §12.3 lists:

مکمل supplement · برند brand · دسته‌بندی category · محصول product · تنوع/گونه variant · طعم flavor · موجودی stock · سبد خرید cart · تسویه‌حساب checkout · سفارش order · ارسال shipping · مشتری customer · کد تخفیف discount code · فاکتور invoice · درگاه پرداخت payment gateway · اینماد enamad

Add a third column, **Code identifier**, giving the English name actually used in code (`Brand`, `ProductVariant`, `Cart`, …) — the glossary's job is to stop two names for one thing, so the mapping must be explicit.

- [ ] **Step 3: Write `docs/regulatory.md`**

Facts and dates only, no advice, each with its source and the date it was checked. Four topics from §11.4 and §18: enamad (اینماد) application requirements; the Iran FDA supplements rule of 13 Jun 2026 and the FDO/pharmacy licence question; TTAC; the rial redenomination and its effect on displayed prices. Mark the licensing item explicitly as **a business risk owned by Saman**, matching §18.

- [ ] **Step 4: Write `docs/decisions/0000-template.md`**

MADR minimal — exactly three required headings, because `check-docs.sh` (Task 14) asserts all three are present in every ADR.

```markdown
# NNNN. <Title>

- Status: proposed | accepted | superseded by [NNNN](NNNN-title.md)
- Date: YYYY-MM-DD

## Context and Problem Statement

<What forces the decision? One or two paragraphs.>

## Considered Options

- <Option 1>
- <Option 2>

## Decision Outcome

Chosen: <option>, because <justification>.

### Consequences

- Good: <consequence>
- Bad: <consequence>
```

- [ ] **Step 5: Verify every relative link resolves**

`check-docs.sh` does not exist yet (Task 14), so check by hand once:

```bash
grep -rhoE '\]\(([^)#]+\.md)[^)]*\)' docs/ --include='*.md' \
  | sed -E 's/^\]\(//; s/\).*$//' | sort -u \
  | while read -r l; do [ -e "docs/$l" ] || [ -e "$l" ] || echo "BROKEN: $l"; done
```

Expected: no output.

- [ ] **Step 6: Commit**

```bash
git add docs/architecture docs/glossary.md docs/regulatory.md docs/decisions
git commit -m "docs: add north star, glossary, regulatory notes and ADR template"
```

---

### Task 9: Architecture decision records

Spec: §12.4. Sixteen of the seventeen ADRs can be written now; **0001 is deliberately left for Phase 2** because it records the NestJS 12 spike outcome (§5.1), which has not happened.

**Files:**

- Create: `docs/decisions/0002-*.md` … `0017-*.md` (16 files)

**Interfaces:**

- Consumes: `docs/decisions/0000-template.md` (Task 8).
- Produces: the ADR set that `check-docs.sh` (Task 14) validates and that `north-star.md` links to.

- [ ] **Step 1: Write ADRs 0002–0013**

One file each, following the template exactly, titled as §12.4's table names them:

| File                               | Title                                                                       |
| ---------------------------------- | --------------------------------------------------------------------------- |
| `0002-drizzle-over-prisma.md`      | Drizzle ORM over Prisma / MikroORM                                          |
| `0003-pnpm-turborepo.md`           | pnpm workspaces + Turborepo                                                 |
| `0004-postgres-16-redis-72.md`     | PostgreSQL 16 and Redis 7.2 (Liara ceilings; UUIDv7 in application code)    |
| `0005-zod-first-contracts.md`      | Zod-first contracts → OpenAPI → openapi-fetch client                        |
| `0006-cache-components.md`         | Next.js Cache Components from day one; Next server is the only API caller   |
| `0007-persian-only-rtl.md`         | Persian-only, RTL-only storefront; Vazirmatn; logical CSS only              |
| `0008-money-irr-minor-units.md`    | Money as IRR minor units with a configurable display unit                   |
| `0009-outbox-before-queue.md`      | Transactional outbox before any queue; BullMQ deferred                      |
| `0010-hosting-liara-arvancloud.md` | Hosting on Liara + ArvanCloud; API not publicly exposed; Liara-built images |
| `0011-no-online-payment.md`        | No online payment at launch; WhatsApp handoff seam in checkout              |
| `0012-human-only-attribution.md`   | Human-only git attribution (plus Renovate) and its enforcement              |
| `0013-public-repository.md`        | Public repository with rulesets on `main`                                   |

For each, **Considered Options** must name the alternatives the spec actually rejected — 0002 lists Prisma and MikroORM; 0010 lists ArvanCloud PaaS and a self-managed Iranian VPS with Coolify/Dokploy (§11.1's exit path); 0009 names BullMQ. An ADR with one option is a note, not a decision.

- [ ] **Step 2: Write ADRs 0014–0017**

These record the 2026-09-23 pin refresh, and each one's **Decision Outcome** must state the condition that would reverse it:

- `0014-typescript-6.md` — held at 6.0.3. Reverses only when **all three** hold: TS 7.1 stable (planned 2026-11-24), nest-cli issue #3479 resolved, typescript-eslint issue #10940 resolved.
- `0015-pnpm-12.md` — adopted 12.5.1 over 11.27.1; `forceLegacyDeploy` kept although ≥ 12.2.0 no longer requires it. Fallback: 11.27.1, still shipping.
- `0016-vitest-5.md` — adopted 5.0.1 on the default `forks` pool; `unplugin-swc` not installed because Oxc emits `design:paramtypes` natively. Reverses if Oxc's documented `Object` fallback for uncomputable types causes a DI failure.
- `0017-redis-throttler-storage.md` — `@nest-lab/throttler-storage-redis` 1.2.0 under a peer override; fallbacks in order are the ioredis hand-roll, then `@nestjs-redis/throttler-storage` 2.0.1 (which would mean swapping ioredis for node-redis).

- [ ] **Step 3: Verify every ADR carries the three MADR headings**

```bash
for f in docs/decisions/0[0-9][0-9][0-9]-*.md; do
  for h in "## Context and Problem Statement" "## Considered Options" "## Decision Outcome"; do
    grep -Fq "$h" "$f" || echo "MISSING in $f: $h"
  done
done
```

Expected: no output.

- [ ] **Step 4: Verify numbering has no gaps or duplicates, and that 0001 is absent**

```bash
ls docs/decisions/ | grep -oE '^[0-9]{4}' | sort | uniq -d   # expect: empty
ls docs/decisions/0001-* 2>/dev/null && echo "0001 must wait for the Phase 2 spike"
```

Expected: no duplicate numbers; no `0001-*` file.

- [ ] **Step 5: Commit**

```bash
git add docs/decisions
git commit -m "docs: add architecture decision records 0002-0017"
```

---

### Task 10: Runbooks

Spec: §9.1, §11.4. Three documents. `go-live.md` and `first-deploy.md` are Phase 4's script, written now because the spec's ordering constraints are fresh and easy to get wrong later.

**Files:**

- Create: `docs/runbooks/iran-mirrors.md`, `docs/runbooks/go-live.md`, `docs/runbooks/first-deploy.md`

**Interfaces:**

- Consumes: nothing.
- Produces: documents referenced by `north-star.md` and by §11.4; `first-deploy.md` is the checklist Phase 4 executes.

- [ ] **Step 1: Write `docs/runbooks/iran-mirrors.md`**

Opt-in machine configuration, never a committed default (§9.1). Record the measured situation: **Docker Hub returns HTTP 403 from an Iranian connection; npm and Homebrew are reachable.** Document both routes — a VPN (the chosen approach for this machine) and, as the alternative, Docker `registry-mirrors` plus `TESTCONTAINERS_HUB_IMAGE_NAME_PREFIX`, which must cover all four local images (`postgres:16`, `redis:7.2-alpine`, `rustfs/rustfs`, `axllent/mailpit`). State plainly that CI pulls run on GitHub runners and Liara builds on its own infrastructure, so only local development is affected.

- [ ] **Step 2: Write `docs/runbooks/go-live.md`**

An ordered checklist, and the order is not negotiable — the private network is chosen at resource-creation time and is **immutable** (§11.2):

1. Create the Liara **private network** before anything else.
2. Create PostgreSQL 16 and Redis 7.2 on that network.
3. Create the object-storage bucket.
4. Create `ds-api` and `ds-web`; **immediately disable `ds-api`'s default `liara.run` subdomain** (Settings → زیردامنه پیش‌فرض — there is no creation-time option and no CLI flag).
5. Set environment variables with `liara env set`, never via `liara.json` `envs`, which replaces all variables. Exact keys per §11.4 and Appendix B.
6. Run `first-deploy.md`.
7. Domains, then ArvanCloud DNS/CDN, then ito.gov.ir half-price registration, then the enamad application.

Record the real-IP header name from ArvanCloud here once known — §7.4 depends on it.

- [ ] **Step 3: Write `docs/runbooks/first-deploy.md`**

Seven verifications, each with the command and the expected answer, from §11.4:

1. **ICU collation** — `SELECT count(*) FROM pg_collation WHERE collprovider = 'i';` on the Liara database. If `0`, the `fa` collation is unavailable and ordering falls back to `search_text` (needs an ADR). **Run this before the first migration**, not after.
2. `TRUST_PROXY` hop count is correct and the real-IP header name is confirmed.
3. Health-check cadence — Liara documents `interval`/`timeout`/`startPeriod` in **milliseconds** but its own example reads like seconds; confirm the effective cadence from the deploy events before trusting the values.
4. The outbox relay's "started" line appears in `ds-api`'s logs.
5. `https://<ds-api>.liara.run` does **not** answer, verified from outside the private network.
6. The storage smoke test passes against Liara with a key scoped to the production bucket. Production `S3_*` values never enter GitHub secrets.
7. Finally, set the repository variable `LIARA_DEPLOY_ENABLED=true` — until then the CI `deploy` job is skipped and `main` stays green without Liara existing.

- [ ] **Step 4: Verify links and commit**

Run the link check from Task 8 Step 5 again.

```bash
git add docs/runbooks
git commit -m "docs: add iran-mirrors, go-live and first-deploy runbooks"
```

---

### Task 11: Instruction files

Spec: §12.1, §12.2 (last bullet), §16 DoD 6. `CLAUDE.md` must stay **under 150 lines** — `check-docs.sh` enforces it in Task 14. Brevity is the point: a long instruction file is a file agents skim.

**Files:**

- Create: `CLAUDE.md`, `AGENTS.md`, `README.md`, `.mcp.json`

**Interfaces:**

- Consumes: `docs/architecture/north-star.md` (Task 8), imported by `CLAUDE.md`.
- Produces: the always-loaded instruction set.

- [ ] **Step 1: Write `CLAUDE.md`**

Five sections, in this order, under 150 lines total:

1. **What this is** — two lines. Persian-language RTL e-commerce for gym supplements; NestJS 12 ESM on Fastify plus a Next.js App Router storefront.
2. **Commands** — `pnpm dev`, `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm check`, `pnpm openapi:generate`.
3. **Non-negotiables** — verbatim from §12.1, one line each:
   - ESM with explicit `.js` relative specifiers and `import.meta.url`; never `__dirname` or `require`.
   - Contracts are Zod only. No class-validator, no class-transformer, no DTO classes, no `@ApiProperty`.
   - Logical Tailwind utilities only (`ms- me- ps- pe- start- end- text-start`).
   - Money is IRR minor units. Never Toman in storage, never floats.
   - Persian copy exists only in `apps/web`. The API speaks English.
   - `catalog:` pins only. Never a floating major. Never `corepack enable`. A package under 24 h old needs `minimumReleaseAgeExclude` — ask first.
   - Never edit `**/src/generated/**` or `openapi.json` by hand.
   - Every task ends with `pnpm check`.
   - Spec → plan → TDD for every feature.
4. **Commit and branch conventions** — conventional commits with the scope list from `commitlint.config.mjs`; trunk-based with short-lived `feat/*`, `fix/*`, `chore/*`, `docs/*`; squash merges. **Every commit is authored solely by Saman Hoseinpour.**
5. **Import** — a single line importing the north star:

```markdown
@docs/architecture/north-star.md
```

- [ ] **Step 2: Write `AGENTS.md`**

Exactly one line, per §12.1:

```markdown
See [CLAUDE.md](CLAUDE.md).
```

- [ ] **Step 3: Write `README.md`**

Public-facing and deliberately plain — this repository is public. What the project is, the stack, prerequisites (Node 24, pnpm 12, OrbStack), quickstart (`pnpm install`, `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev`), a repository-layout table, and links to the spec and north star. No business analysis, no regulatory discussion, no personal detail — that material is what §19.2 moved out of this repository.

- [ ] **Step 4: Write `.mcp.json`**

Context7 only. The key is expanded from the environment and **never** written into the file — `check-docs.sh` asserts this in Task 14.

```json
{
  "mcpServers": {
    "context7": {
      "type": "http",
      "url": "https://mcp.context7.com/mcp",
      "headers": { "CONTEXT7_API_KEY": "${CONTEXT7_API_KEY}" }
    }
  }
}
```

- [ ] **Step 5: Verify the line budget**

Run: `wc -l CLAUDE.md`

Expected: fewer than 150. If it is over, cut prose — the rules are the payload.

- [ ] **Step 6: Commit**

```bash
git add CLAUDE.md AGENTS.md README.md .mcp.json
git commit -m "docs: add instruction files and MCP configuration"
```

---

### Task 12: `.claude/rules/`

Spec: §12.1. Nine path-scoped rule files, each with `paths:` frontmatter so it loads only when a matching file is touched. Contents are enumerated in §12.1 — transcribe them rather than paraphrasing.

**Files:**

- Create: `.claude/rules/{api,web,contracts,db,persian,security,testing,generated,docs}.md`

**Interfaces:**

- Consumes: nothing.
- Produces: the rule set `check-docs.sh` (Task 14) checks for existence.

- [ ] **Step 1: Write each rule file with `paths:` frontmatter**

Format:

```markdown
---
paths:
  - 'apps/api/**'
---

# API rules

...
```

Path globs and minimum contents, exactly as §12.1 specifies:

| File           | `paths:`                                                                                | Must contain                                                                                                                                                                                                                                                                                                                                                                           |
| -------------- | --------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `api.md`       | `apps/api/**`                                                                           | Fastify adapter options; no `ValidationPipe`; no global prefix or URI versioning; no `MiddlewareConsumer` (use guards/interceptors/`fastify.addHook`); terminus `HealthIndicatorService` not the deprecated base class; no `@nestjs/event-emitter`; Vitest + `app.inject()` — no supertest, no Jest globals                                                                            |
| `web.md`       | `apps/web/**`                                                                           | No route segment configs (`dynamic`/`revalidate`/`fetchCache`); `cacheLife`/`cacheTag`/`io` from `next/cache`, with `io()` before uncached work inside page islands; `connection` from `next/server` only in route handlers and `sitemap.ts`; `params`/`searchParams` awaited inside `<Suspense>`; `publicApi` vs `requestApi()`; `next/font/local` only; `eslint .` never `next lint` |
| `contracts.md` | `packages/contracts/**`                                                                 | Zod 4 top-level forms; results expose `issues`, never `errors`; **Zod 4.6: `z.iso.datetime()` requires seconds, and `.min`/`.max`/`.length` count code points**                                                                                                                                                                                                                        |
| `db.md`        | `**/infrastructure/schema.ts`, `apps/api/drizzle/**`, `apps/api/src/infra/**/schema.ts` | camelCase keys with `casing` deriving snake_case names; `drizzle-kit generate` plus committed SQL; **never `push`**; the §6.3 convention table                                                                                                                                                                                                                                         |
| `persian.md`   | `packages/persian/**`, `packages/contracts/**`, `apps/web/**`                           | Normalization happens on write in the domain entity; formatting happens on the server only; `TEHRAN_TZ` is the single timezone constant                                                                                                                                                                                                                                                |
| `security.md`  | (unscoped)                                                                              | Env files are never read or committed; no secret in `.env.example`; stack traces never leave the process in production                                                                                                                                                                                                                                                                 |
| `testing.md`   | `**/*.test.ts`, `**/*.test.tsx`, `**/e2e/**`                                            | Unit vs integration split; truncation isolation, not transaction rollback; call `runOnce()` directly in outbox tests; **Vitest 5: `clearMocks` explicit, `vi.mock`/`vi.hoisted` at module top level only, one config per workspace**                                                                                                                                                   |
| `generated.md` | `**/src/generated/**`, `**/openapi.json`                                                | Never edit by hand; regenerate with `pnpm openapi:generate`                                                                                                                                                                                                                                                                                                                            |
| `docs.md`      | `docs/**`                                                                               | Introducing a term or a decision means updating the glossary or writing an ADR                                                                                                                                                                                                                                                                                                         |

- [ ] **Step 2: Verify frontmatter parses and every file has a `paths:` key**

```bash
for f in .claude/rules/*.md; do
  head -1 "$f" | grep -q '^---$' || echo "NO FRONTMATTER: $f"
  grep -q '^paths:' "$f" || echo "NO paths KEY: $f"
done
```

Expected: no output for the eight scoped files. `security.md` is intentionally unscoped — if you scope it, it stops applying everywhere.

- [ ] **Step 3: Commit**

```bash
git add .claude/rules
git commit -m "chore: add path-scoped agent rules"
```

---

### Task 13: `.claude/` settings, hooks, agents and skills

Spec: §12.2, §13.4(1)(2), §16 DoD 6. This is the agent-facing enforcement layer.

**Files:**

- Create: `.claude/settings.json`, `.claude/hooks/{no-ai-trailers,format-and-lint,verify}.sh`, `.claude/agents/reviewer.md`, `.claude/skills/{adr,new-api-module,new-web-route,verify}/SKILL.md`
- Modify: `package.json` (add a `prepare` script — see Step 1)

**Interfaces:**

- Consumes: `scripts/check-commit-msg.sh` logic (Task 7), `pnpm check` (Task 1).
- Produces: hooks that fire on every Edit/Write, Bash git-commit and Stop.

- [ ] **Step 1: Resolve a conflict in the spec before writing settings**

§12.2 **denies** `Bash(pnpm exec *)`, but `pnpm exec lefthook install`, `pnpm exec eslint` and `pnpm exec commitlint` are all needed. Git hooks run outside Claude's permission system so `lefthook.yml` is unaffected, but an agent would be blocked from installing the hooks at all.

Resolve it the way that removes the need rather than widening the deny: add a `prepare` script to the root `package.json`, so hooks install automatically on `pnpm install`.

```json
"prepare": "lefthook install"
```

Keep `Bash(pnpm exec *)` denied. Record the conflict and this resolution in `ADR-0012`.

- [ ] **Step 2: Write `.claude/settings.json`**

Transcribe §12.2's three permission lists exactly. `defaultMode` is `acceptEdits`. Attribution is empty strings, which is what stops the text ever being generated (layer 1 of §13.4).

```json
{
  "attribution": { "commit": "", "pr": "", "sessionUrl": false },
  "includeCoAuthoredBy": false,
  "permissions": {
    "defaultMode": "acceptEdits",
    "allow": [
      "Bash(pnpm check*)",
      "Bash(pnpm check:*)",
      "Bash(pnpm lint*)",
      "Bash(pnpm typecheck*)",
      "Bash(pnpm test*)",
      "Bash(pnpm build*)",
      "Bash(pnpm dev*)",
      "Bash(pnpm db:*)",
      "Bash(pnpm openapi:generate*)",
      "Bash(pnpm format*)",
      "Bash(pnpm e2e*)",
      "Bash(pnpm boundaries*)",
      "Bash(pnpm install)",
      "Bash(pnpm audit:authors*)",
      "Bash(git status *)",
      "Bash(git diff *)",
      "Bash(git log *)",
      "Bash(git add *)",
      "Bash(git commit *)",
      "Bash(gh pr view *)",
      "Bash(gh pr create *)",
      "WebFetch(domain:docs.nestjs.com)",
      "WebFetch(domain:nextjs.org)",
      "WebFetch(domain:orm.drizzle.team)"
    ],
    "ask": [
      "Bash(git push *)",
      "Bash(pnpm add *)",
      "Bash(pnpm install *)",
      "Bash(pnpm remove *)",
      "Bash(pnpm update *)",
      "Bash(pnpm --filter *)",
      "Bash(pnpm dlx *)"
    ],
    "deny": [
      "Read(.env)",
      "Read(.env.local)",
      "Read(.env.*.local)",
      "Read(./**/dist/**)",
      "Read(./**/.next/**)",
      "Read(./**/coverage/**)",
      "Edit(./pnpm-lock.yaml)",
      "Bash(pnpm exec *)",
      "Bash(pnpm publish *)",
      "Bash(git commit *--no-verify*)",
      "Bash(git commit *-n *)",
      "Bash(curl *)",
      "Bash(wget *)",
      "Bash(rm -rf *)"
    ]
  },
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash",
        "hooks": [{ "type": "command", "command": "bash .claude/hooks/no-ai-trailers.sh" }]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Edit|Write",
        "hooks": [{ "type": "command", "command": "bash .claude/hooks/format-and-lint.sh" }]
      }
    ],
    "Stop": [{ "hooks": [{ "type": "command", "command": "bash .claude/hooks/verify.sh" }] }]
  }
}
```

Note `Read(.env)` uses a bare filename, which matches at any depth, while `.env.example` stays readable and editable (§9.3). A Read deny also blocks Edit and Write on the same path, which is why `.env.example` must never match one.

- [ ] **Step 3: Write the three hook scripts**

`no-ai-trailers.sh` — reads the hook JSON on stdin, pulls `.tool_input.command` with `jq`, exits **2** with a reason (exit 2 is what blocks the tool call):

```bash
#!/usr/bin/env bash
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
```

`format-and-lint.sh` — prettier, then eslint for `.ts`/`.tsx`; exits 0 for any other file type so it never blocks non-code edits.

`verify.sh` — exits 0 immediately when `stop_hook_active` is true (otherwise it recurses); otherwise runs `pnpm turbo run typecheck test --affected --output-logs=errors-only` and exits 2 with the last 40 lines on failure.

- [ ] **Step 4: Verify the hooks are shellcheck-clean**

`check-docs.sh` will enforce this in Task 14, so fix it now rather than there.

Run: `shellcheck .claude/hooks/*.sh scripts/*.sh`

Expected: no output, exit 0.

- [ ] **Step 5: Verify the trailer hook actually blocks**

```bash
echo '{"tool_input":{"command":"git commit -m \"x\" -m \"Co-Authored-By: C <n@anthropic.com>\""}}' \
  | bash .claude/hooks/no-ai-trailers.sh; echo "exit: $?"
echo '{"tool_input":{"command":"git commit -m \"chore: fine\""}}' \
  | bash .claude/hooks/no-ai-trailers.sh; echo "exit: $?"
```

Expected: `exit: 2` then `exit: 0`.

- [ ] **Step 6: Write `.claude/agents/reviewer.md` and the four skills**

`reviewer.md` — read-only (Read/Grep/Glob/Bash), scoped to correctness, security, module boundaries, RTL/Persian correctness, and requirement gaps.

Skills, each in `.claude/skills/<name>/SKILL.md` with `name` and `description` frontmatter. The three with side effects set `disable-model-invocation: true` so they only run when asked by name:

| Skill            | Does                                                                                                           | `disable-model-invocation` |
| ---------------- | -------------------------------------------------------------------------------------------------------------- | -------------------------- |
| `adr`            | Creates `docs/decisions/NNNN-title.md` from `0000-template.md`, picking the next free number                   | `true`                     |
| `new-api-module` | Copies the `catalog` module anatomy (§5.3) into a new context with names replaced                              | `true`                     |
| `new-web-route`  | Scaffolds a route in the §7.5 shape — uncached page, `<Suspense>`, `await io()`, a `'use cache'` data function | `true`                     |
| `verify`         | Runs `pnpm check` and summarizes the result                                                                    | —                          |

`new-api-module` cannot be fully verified until Phase 2 gives it a `catalog` module to copy. Note that in the skill body; DoD 6's check of it belongs to Phase 3.

- [ ] **Step 7: Commit**

```bash
git add .claude package.json
git commit -m "chore: add agent settings, hooks, reviewer and skills"
```

---

### Task 14: `check-docs.sh` — definition-of-done 6

Spec: §16 DoD 6, §9.3. Written **after** Tasks 8–13 because it validates what they produce. It is part of `pnpm check`, so from here on a missing document fails the build.

**Files:**

- Create: `scripts/check-docs.sh`, `scripts/check-docs.manifest`

**Interfaces:**

- Consumes: every file created in Tasks 8–13.
- Produces: `pnpm check:docs`, called by `pnpm check` and `pnpm check:affected` (Task 1) and therefore by CI (Task 15).

- [ ] **Step 1: Write the failing test**

`scripts/test-check-docs.sh`, covering the two Review Focus items that belong here.

```bash
#!/usr/bin/env bash
set -uo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
ROOT="$(cd "$HERE/.." && pwd)"
PASS=0; FAIL=0
ok()  { echo "  PASS  $1"; PASS=$((PASS+1)); }
bad() { echo "  FAIL  $1"; FAIL=$((FAIL+1)); }

# 1. The real repository passes.
( cd "$ROOT" && bash scripts/check-docs.sh >/dev/null 2>&1 ) \
  && ok "repository passes" || bad "repository passes"

# 2. Review Focus 4: a drifted .liaraignore is caught.
cp "$ROOT/.liaraignore" /tmp/liara.bak
printf 'drift\n' >> "$ROOT/.liaraignore"
( cd "$ROOT" && bash scripts/check-docs.sh >/dev/null 2>&1 ) \
  && bad "ignore-file drift caught" || ok "ignore-file drift caught"
cp /tmp/liara.bak "$ROOT/.liaraignore"; rm -f /tmp/liara.bak

# 3. Review Focus 3: a link whose case differs is caught even on a
#    case-insensitive filesystem, because macOS would resolve it and Linux
#    CI would not.
printf '\n[case](North-Star.md)\n' >> "$ROOT/docs/architecture/north-star.md"
( cd "$ROOT" && bash scripts/check-docs.sh >/dev/null 2>&1 ) \
  && bad "wrong-case link caught" || ok "wrong-case link caught"
( cd "$ROOT" && git checkout -- docs/architecture/north-star.md )

# 4. An over-long CLAUDE.md is caught.
cp "$ROOT/CLAUDE.md" /tmp/claude.bak
for _ in $(seq 1 200); do echo "padding" >> "$ROOT/CLAUDE.md"; done
( cd "$ROOT" && bash scripts/check-docs.sh >/dev/null 2>&1 ) \
  && bad "over-long CLAUDE.md caught" || ok "over-long CLAUDE.md caught"
cp /tmp/claude.bak "$ROOT/CLAUDE.md"; rm -f /tmp/claude.bak

# 5. A literal key in .mcp.json is caught.
cp "$ROOT/.mcp.json" /tmp/mcp.bak
sed -i.tmp 's/\${CONTEXT7_API_KEY}/ctx7sk-real-looking-key-000000/' "$ROOT/.mcp.json"
( cd "$ROOT" && bash scripts/check-docs.sh >/dev/null 2>&1 ) \
  && bad "literal MCP key caught" || ok "literal MCP key caught"
cp /tmp/mcp.bak "$ROOT/.mcp.json"; rm -f /tmp/mcp.bak "$ROOT/.mcp.json.tmp"

echo; echo "passed: $PASS   failed: $FAIL"
[ "$FAIL" -eq 0 ]
```

- [ ] **Step 2: Run it to make sure it fails**

Run: `bash scripts/test-check-docs.sh`

Expected: failures — `check-docs.sh` does not exist.

- [ ] **Step 3: Write `scripts/check-docs.manifest`**

The §4.1 file list, one path per line, so the manifest is data rather than code:

```
docs/architecture/north-star.md
docs/glossary.md
docs/regulatory.md
docs/decisions/0000-template.md
docs/runbooks/iran-mirrors.md
docs/runbooks/go-live.md
docs/runbooks/first-deploy.md
CLAUDE.md
AGENTS.md
README.md
.mcp.json
.claude/settings.json
.claude/agents/reviewer.md
.claude/hooks/no-ai-trailers.sh
.claude/hooks/format-and-lint.sh
.claude/hooks/verify.sh
.claude/rules/api.md
.claude/rules/web.md
.claude/rules/contracts.md
.claude/rules/db.md
.claude/rules/persian.md
.claude/rules/security.md
.claude/rules/testing.md
.claude/rules/generated.md
.claude/rules/docs.md
.github/workflows/ci.yml
.github/workflows/deploy.yml
.github/PULL_REQUEST_TEMPLATE.md
.github/renovate.json
scripts/audit-authors.sh
scripts/audit-authors.allowed
scripts/check-commit-msg.sh
scripts/check-docs.sh
```

- [ ] **Step 4: Write `scripts/check-docs.sh`**

```bash
#!/usr/bin/env bash
# Definition-of-done 6 (spec §16). Part of `pnpm check`.
set -uo pipefail
cd "$(dirname "$0")/.."
status=0
fail() { echo "check-docs: $*" >&2; status=1; }

# 1. Every manifest entry exists.
while IFS= read -r f; do
  [ -z "$f" ] && continue
  [ -e "$f" ] || fail "missing file: $f"
done < scripts/check-docs.manifest

# 2. CLAUDE.md budgets.
[ -f CLAUDE.md ] && {
  n=$(wc -l < CLAUDE.md)
  [ "$n" -lt 150 ] || fail "CLAUDE.md is $n lines (limit 150)"
}
for f in apps/*/CLAUDE.md packages/*/CLAUDE.md; do
  [ -f "$f" ] || continue
  n=$(wc -l < "$f")
  [ "$n" -le 60 ] || fail "$f is $n lines (limit 60)"
done

# 3. Every ADR carries the three MADR headings.
for f in docs/decisions/[0-9][0-9][0-9][0-9]-*.md; do
  [ -f "$f" ] || continue
  for h in "## Context and Problem Statement" "## Considered Options" "## Decision Outcome"; do
    grep -Fq "$h" "$f" || fail "$f missing heading: $h"
  done
done

# 4. Every relative markdown link resolves, case-exactly. Compared against
#    `git ls-files` rather than the filesystem, because macOS is
#    case-insensitive and the CI runner is not.
tracked=$(git ls-files)
while IFS= read -r line; do
  f="${line%%:*}"; target="${line#*:}"
  case "$target" in http*|"#"*|mailto:*) continue;; esac
  resolved=$(cd "$(dirname "$f")" && printf '%s' "$(realpath -m --relative-to="$(git rev-parse --show-toplevel)" "$target" 2>/dev/null)")
  [ -n "$resolved" ] || resolved="$target"
  printf '%s\n' "$tracked" | grep -Fxq "$resolved" \
    || fail "broken or wrong-case link in $f -> $target"
done < <(grep -rhnoE --include='*.md' '\]\([^):#]+\.md\)' . \
          --exclude-dir=node_modules --exclude-dir=.git 2>/dev/null \
        | sed -E 's/^([^:]+):[0-9]+:\]\(/\1:/; s/\)$//' || true)

# 5. Hook and script shell files are shellcheck-clean.
if command -v shellcheck >/dev/null 2>&1; then
  shellcheck .claude/hooks/*.sh scripts/*.sh || fail "shellcheck reported problems"
else
  fail "shellcheck is not installed (brew install shellcheck)"
fi

# 6. .mcp.json holds no literal key.
[ -f .mcp.json ] && {
  grep -q '\${CONTEXT7_API_KEY}' .mcp.json || fail ".mcp.json must expand \${CONTEXT7_API_KEY}"
  grep -Eq '"(ctx7sk|sk)-[A-Za-z0-9_-]{8,}"' .mcp.json && fail ".mcp.json contains a literal key"
}

# 7. .dockerignore and .liaraignore are byte-identical (§9.3).
cmp -s .dockerignore .liaraignore || fail ".dockerignore and .liaraignore differ"

[ "$status" -eq 0 ] && echo "check-docs: OK"
exit "$status"
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `chmod +x scripts/check-docs.sh scripts/test-check-docs.sh && bash scripts/test-check-docs.sh`

Expected: `passed: 5   failed: 0`.

If case 3 fails, the link resolution is falling back to the filesystem — on macOS that silently accepts wrong-case links, which is precisely the bug this check exists to prevent.

- [ ] **Step 6: Run the full verification command for the first time**

Run: `pnpm check`

Expected: exit 0, ending with `check-docs: OK`. Turbo finds no `lint`/`typecheck`/`test` tasks (no workspaces implement them yet); `sherif` reports no version drift; `check:docs` passes.

> **Do not run `sherif -f`.** Its autofix removes `apps/*` from `pnpm-workspace.yaml`, because no app matches the glob until Phase 2, and reformats the file while it is there. The unmatched-glob finding is a _warning_ and sherif exits 0 on warnings, so nothing needs fixing. Fix reported _errors_ by hand.

- [ ] **Step 7: Commit**

```bash
git add scripts/check-docs.sh scripts/check-docs.manifest scripts/test-check-docs.sh
git commit -m "chore: add docs and configuration verification script"
```

---

### Task 15: GitHub Actions and dependency policy

Spec: §9.5, §10.1, §13.3. Only the three jobs that have something to check exist now. `openapi`, `e2e` and `docker` arrive with their subjects in Phases 2–4 — adding them early would mean either a red `main` or a required check that never reports.

**Files:**

- Create: `.github/workflows/ci.yml`, `.github/workflows/deploy.yml`, `.github/PULL_REQUEST_TEMPLATE.md`, `.github/renovate.json`

**Interfaces:**

- Consumes: `pnpm check:affected` (Task 1), `pnpm audit:authors` (Task 6).
- Produces: the status checks `check`, `authors`, `secrets` that Task 16 marks required.

- [ ] **Step 1: Write `.github/workflows/ci.yml`**

`fetch-depth: 0` is what makes both `--affected` and `audit-authors.sh`'s PR range work (Review Focus 1). `permissions: contents: read` is the whole workflow's ceiling.

```yaml
name: CI
on:
  pull_request:
  push:
    branches: [main]
  schedule:
    - cron: '0 3 * * 1'
  workflow_dispatch:

permissions:
  contents: read

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

jobs:
  check:
    if: github.event_name != 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with: { fetch-depth: 0 }
      - uses: pnpm/action-setup@v4
      - uses: actions/setup-node@v5
        with: { node-version-file: .node-version, cache: pnpm }
      - run: pnpm install --frozen-lockfile
      - run: pnpm check:affected

  authors:
    if: github.event_name != 'schedule'
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with: { fetch-depth: 0 }
      - run: bash scripts/audit-authors.sh

  secrets:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v5
        with: { fetch-depth: 0 }
      - uses: gitleaks/gitleaks-action@v2
        env:
          GITLEAKS_ENABLE_UPLOAD_ARTIFACT: 'false'
```

Two notes. `pnpm/action-setup` installs dependencies by default — there is no second `pnpm install`, which is why the explicit `--frozen-lockfile` step is the only install. Every action here must be **SHA-pinned by Renovate** before the first push is considered done; the tags above are placeholders for readability only, and `helpers:pinGitHubActionDigests` in Step 4 is what converts them.

The weekly `schedule` trigger runs only `secrets`, which is how the **full** history gets scanned (the action scans just the event's commit range on push and pull_request).

- [ ] **Step 2: Write `.github/workflows/deploy.yml`**

Manual only, and inert until Phase 4 sets `LIARA_DEPLOY_ENABLED`. It exists now so §4.1's file list is complete and `check-docs.sh` passes.

```yaml
name: Deploy
on:
  workflow_dispatch:

permissions:
  contents: read

jobs:
  deploy:
    if: vars.LIARA_DEPLOY_ENABLED == 'true'
    runs-on: ubuntu-latest
    environment: production
    steps:
      - run: echo "Liara deploy steps arrive in Phase 4 (spec §10.2)."
```

- [ ] **Step 3: Write `.github/PULL_REQUEST_TEMPLATE.md`**

The five-item checklist from §13.3: spec/plan linked · tests added · `pnpm check` green · no AI trailers · docs or ADR updated if a term or decision was introduced.

- [ ] **Step 4: Write `.github/renovate.json`**

```json
{
  "$schema": "https://docs.renovatebot.com/renovate-schema.json",
  "extends": [
    "config:recommended",
    ":semanticCommits",
    "helpers:pinGitHubActionDigests",
    "schedule:weekly"
  ],
  "minimumReleaseAge": "3 days",
  "packageRules": [
    { "groupName": "nestjs", "matchPackageNames": ["@nestjs/**", "@nest-lab/**"] },
    {
      "groupName": "next",
      "matchPackageNames": ["next", "react", "react-dom", "eslint-config-next"]
    },
    {
      "groupName": "eslint",
      "matchPackageNames": ["eslint", "typescript-eslint", "eslint-plugin-**"]
    },
    { "groupName": "drizzle", "matchPackageNames": ["drizzle-orm", "drizzle-kit"] },
    {
      "matchDepTypes": ["devDependencies"],
      "matchUpdateTypes": ["patch", "minor"],
      "automerge": true
    },
    {
      "matchPackageNames": ["typescript"],
      "allowedVersions": "<6.1.0",
      "description": "Spec §3 — @nestjs/cli and typescript-eslint both reject TS 7. Re-evaluate no earlier than 2026-11-24."
    },
    {
      "matchPackageNames": ["drizzle-orm", "drizzle-kit"],
      "allowedVersions": "<1.0.0",
      "description": "Spec D6 — Drizzle 1.0 is still pre-release."
    },
    {
      "matchPackageNames": ["ioredis"],
      "allowedVersions": "<6.0.0",
      "description": "Spec §4.2 — ioredis 6 defaults to RESP3."
    }
  ]
}
```

devDependency automerge works **only** because `scripts/audit-authors.allowed` lists `renovate[bot]` (§9.5, §13.4). Removing that line silently breaks every automerged PR.

- [ ] **Step 5: Verify the workflows parse**

```bash
for f in .github/workflows/*.yml; do
  node -e "require('fs').readFileSync('$f','utf8')" && echo "read ok: $f"
done
pnpm check
```

Expected: `pnpm check` exits 0 — the manifest entries added in Task 14 now all resolve. Actual YAML validity is confirmed by the first CI run in Task 16.

- [ ] **Step 6: Commit**

```bash
git add .github
git commit -m "ci: add CI workflow, PR template and Renovate configuration"
```

---

### Task 16: First push and branch protection

Spec: §13.1, §13.3, §16 DoD 7. **Saman must be present for this task** — it makes the repository public and permanent.

**Files:** none created. This is a git and GitHub operation.

**Interfaces:**

- Consumes: everything from Tasks 1–15.
- Produces: `github.com/samanhoseinpour/dubai-supplement`, public, with `main` protected.

- [ ] **Step 1: Verify the working tree and history are clean**

```bash
pnpm check
pnpm audit:authors
git status --short
git log --format='%an <%ae>' | sort -u
```

Expected: `check-docs: OK`; `audit-authors: OK (N commits)`; empty status; **exactly one** author line, the noreply identity.

- [ ] **Step 2: Confirm no application code is being pushed**

§13.1 requires the first push to contain docs, `.claude/**`, `.github/**`, `scripts/` and root configuration only.

```bash
git ls-files | grep -E '^apps/' && echo "STOP: application code present" || echo "OK: no application code"
```

Expected: `OK: no application code`.

- [ ] **Step 3: Confirm no secret is about to become public**

```bash
git ls-files | grep -E '(^|/)\.env' && echo "STOP: env file tracked" || echo "OK: no env files tracked"
grep -rn 'CONTEXT7_API_KEY' .mcp.json
```

Expected: `OK: no env files tracked`, and `.mcp.json` shows the `${CONTEXT7_API_KEY}` expansion, never a literal.

- [ ] **Step 4: Create the repository and push**

With Saman present:

```bash
gh repo create samanhoseinpour/dubai-supplement --public --source=. --remote=origin --push
```

- [ ] **Step 5: Wait for the first CI run and confirm it is green**

```bash
gh run watch
```

Expected: `check`, `authors` and `secrets` all pass. This is Review Focus 1 — if `check` errors on a missing `--affected` base, fix it here before any protection is added, because a broken required check locks the branch.

- [ ] **Step 6: Enable the ruleset with only the checks that have reported**

Require a pull request; require **`authors` and `secrets` only**; block force-pushes and deletions; allow repository-admin bypass for emergencies. `check` is added once it has reported green on `main`; `openapi`, `e2e` and `docker` wait for Phases 2–4 (§13.1). This is Review Focus 2 — a required check that has never reported blocks every pull request.

Also enable **secret scanning** and **push protection** in the repository's security settings, as the second net behind gitleaks (§18).

- [ ] **Step 7: Verify protection actually holds**

```bash
git commit --allow-empty -m "chore: verify branch protection"
git push origin main
```

Expected: **rejected**, because `main` now requires a pull request. Then `git reset --hard HEAD~1` to discard the test commit.

- [ ] **Step 8: Record the outcome**

Update `docs/decisions/0013-public-repository.md`'s **Decision Outcome** with the date the repository went public and the exact set of required checks enabled, then commit that on a branch and merge it as the first real pull request — which doubles as an end-to-end test of the protection rules.

---

## Phase 1 exit criteria

| #   | Criterion                                                                                                          | Spec            |
| --- | ------------------------------------------------------------------------------------------------------------------ | --------------- |
| 1   | `pnpm install` succeeds from a clean clone; `pnpm install --frozen-lockfile` is a no-op                            | §4.2            |
| 2   | `pnpm check` exits 0 and ends with `check-docs: OK`                                                                | §4.4, §16.6     |
| 3   | `pnpm audit:authors` reports one allowed author and zero AI trailers                                               | §16.7           |
| 4   | A local commit containing `Co-Authored-By:` is rejected by the `commit-msg` hook                                   | §16.6           |
| 5   | Repository is public at `github.com/samanhoseinpour/dubai-supplement`, `main` protected with `authors` + `secrets` | §16.7           |
| 6   | CI is green on `main`                                                                                              | §16.2 (partial) |
| 7   | ADRs 0002–0017 exist and each carries three MADR headings; **0001 is deliberately absent**                         | §12.4, §16.8    |

**Not** in Phase 1: any `apps/` code, `infra/`, the three compiled packages, the NestJS 12 spike, Docker images, Liara. Phase 2 begins with the spike (§5.1), whose prerequisites — the root workspace, `@ds/config-typescript`, `@ds/config-eslint`, and a passing `pnpm install` — are exactly what Tasks 1–4 deliver.
