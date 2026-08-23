# Security Advisories — Accepted Risk Log

This document records `npm audit` findings the project has formally reviewed and
decided **not** to patch immediately, along with the reasoning. It exists so that
accepting a risk is a deliberate, written decision — not silence that gets
mistaken for "nobody looked at this."

`.github/workflows/ci.yml`'s `security-audit` job (and its supporting script,
`scripts/check-security-advisories.mjs`) reads the advisory IDs below and only fails
the build on a high/critical advisory that is **not** listed here. When an entry
below is resolved (patched, or the accepted risk no longer applies), remove it from
both this file and the `ACCEPTED_ADVISORIES` list in
`scripts/check-security-advisories.mjs` — they must be kept in sync by hand.

---

## GHSA-ggr8-5vv4-36mx — deepmerge-ts stack exhaustion

- **Advisory:** https://github.com/advisories/GHSA-ggr8-5vv4-36mx
- **Severity:** High (CWE-674 — uncontrolled recursion)
- **Date reviewed:** 2026-08-23
- **Status:** Accepted — not patching for now (see reasoning below)

### Where it shows up

`npm audit` reports this as **3 separate findings**, all the same underlying
advisory propagating up one dependency chain:

```
deepmerge-ts        (the actual vulnerable package)
  -> @prisma/config  (depends on deepmerge-ts)
    -> prisma        (the prisma CLI package, depends on @prisma/config)
```

### Why this is being accepted, not patched

- **Dev-only tool, not a production runtime path.** `deepmerge-ts` reaches this
  project exclusively through `@prisma/config`, a dependency of the `prisma` CLI
  package (`npx prisma migrate dev`, `npx prisma studio`, `npx prisma generate`, all
  run by hand or in CI on a developer/build machine). The vulnerable code never ships
  into what actually runs in production: `lib/prisma.ts` imports `@prisma/client`
  (via `@prisma/adapter-neon`) directly — a completely separate package from the CLI,
  outside this dependency chain entirely. There is no request-handling code path in
  this app that can trigger the CLI's use of `deepmerge-ts`.
- **The vulnerability itself is a stack-exhaustion DoS** (recursively merging a
  maliciously deep object graph can crash the process) — even in the CLI, this would
  require something feeding it adversarial, deeply-nested config input, which isn't
  how `prisma.config.ts` is used here (a small, static, developer-authored file).
- **The available fix is a disproportionate downgrade.** `npm audit fix --force`'s
  only offered fix is downgrading `prisma` to `6.12.0` (`isSemVerMajor: true`) — well
  before the `prisma.config.ts` + `@prisma/adapter-neon` driver-adapter architecture
  this project is built on (see `lib/prisma.ts`, `prisma/schema.prisma`'s
  `generator client { provider = "prisma-client" }`). Taking that downgrade would
  break the current schema/config setup to avoid a dev-tool-only DoS advisory — not a
  reasonable trade.
- **Not a one-off — this is a recurring pattern on Prisma's side.** Older Prisma 6.x
  CLI releases have separately pulled in vulnerable transitive dependencies of their
  own (e.g. via `lodash`/`chevrotain`) at different points. This reads as an ongoing
  churn in the Prisma CLI's own dependency tree, not a configuration mistake in this
  project — patching around each occurrence by downgrading isn't a sustainable
  response, and each one still only affects the same dev-only CLI surface.

### What happens when a real fix lands

Dependabot (`.github/dependabot.yml`, weekly npm scans) and the `security-audit` CI
job will surface a new `prisma`/`@prisma/config` release that resolves this without
requiring the 6.12.0 downgrade — at that point, upgrade normally, then remove this
entry (and its `ACCEPTED_ADVISORIES` counterpart) from both files.
