---
---

# Security rules

These apply everywhere. The repository is **public**.

- **Never read or commit an env file.** Only `.env`, `.env.local` and
  `.env.*.local` may hold real values, and all three are git-ignored and
  Read-denied. `.env.example` is committed, holds schema-valid placeholders,
  and never a real secret.
- **Never write a literal key into a committed file** — `.mcp.json` expands
  `${CONTEXT7_API_KEY}` from the environment.
- **Production `S3_*` values never enter GitHub secrets.** They are set once
  with `liara env set` from the operator's shell.
- **Stack traces never leave the process in production.** The global
  exception filter emits RFC 9457 `problem+json` with a code, never an
  internal message.
- **The API is not publicly reachable.** Its default Liara subdomain is
  disabled and verified from outside the private network.
- **Cookies** are `httpOnly; Secure; SameSite=Lax` with **no `Domain`**
  attribute.
