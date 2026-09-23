# Pulling container images from Iran

Opt-in machine configuration. **Never a committed default** — nothing in the
repository assumes any of this.

## The measured situation (2026-09-23)

From an Iranian connection, on this machine:

| Source       | Result                                              |
| ------------ | --------------------------------------------------- |
| Docker Hub   | **HTTP 403 Forbidden** on `docker pull hello-world` |
| npm registry | reachable                                           |
| Homebrew     | reachable                                           |

So the block is Docker Hub specifically, not the network generally.

## Scope: this affects local development only

- **CI** pulls run on GitHub's ubuntu runners, outside Iran. Unaffected.
- **Liara** builds images on its own infrastructure from our Dockerfiles.
  If its build host cannot pull a base image, the documented remedy is
  `liara deploy --build-location germany`, not anything here.
- **Local `pnpm db:up` and Testcontainers** are the only things that need
  Docker Hub from this machine.

## Route 1 — VPN (what this machine uses)

Connect the VPN before `pnpm db:up`, `pnpm test:integration` or `pnpm e2e`.
Nothing to configure; `docker pull` then succeeds. This is the chosen
approach and needs no repository change.

## Route 2 — a registry mirror

If a VPN is not available, point Docker at a mirror and tell Testcontainers
to use the same prefix. Both are machine-level settings.

Docker Desktop / OrbStack, in the daemon configuration:

```json
{ "registry-mirrors": ["https://<mirror-host>"] }
```

Testcontainers needs its own prefix, because it does not read
`registry-mirrors`:

```sh
export TESTCONTAINERS_HUB_IMAGE_NAME_PREFIX=<mirror-host>/
```

`turbo.json` already passes `TESTCONTAINERS_*` through `globalPassThroughEnv`,
so this works without touching any committed file.

The prefix must cover **all four** images the local stack uses:

| Image              | Used by                                   |
| ------------------ | ----------------------------------------- |
| `postgres:16`      | `infra/compose.yaml`, Testcontainers      |
| `redis:7.2-alpine` | `infra/compose.yaml`, Testcontainers      |
| `rustfs/rustfs`    | `infra/compose.yaml`, Testcontainers (S3) |
| `axllent/mailpit`  | `infra/compose.yaml`                      |

Iranian mirror hostnames change without notice under sanctions pressure, so
none is recorded here. Verify a candidate with
`docker manifest inspect <mirror-host>/library/postgres:16` before relying
on it.
