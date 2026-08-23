![CI](https://github.com/hanguyn0610/your-shelve/actions/workflows/ci.yml/badge.svg)

# Your Shelve

A collection-tracking web app for manga and light novel readers who own physical
volumes: track which volumes you have, per-volume price and edition, and how much
you've spent over time — instead of a spreadsheet or trying to remember at the
bookstore.

## Tech Stack

- **Frontend:** Next.js 16 (App Router), TypeScript, TailwindCSS, Framer Motion
- **Backend:** Next.js API Routes
- **Database:** PostgreSQL (Neon) + Prisma 7 via a driver adapter (`@prisma/adapter-neon`)
- **Auth:** JWT (short-lived access token + rotating refresh token) in httpOnly cookies, bcrypt password hashing
- **Image storage:** Cloudinary (cover uploads)
- **External data:** AniList GraphQL API (trending manga/LN, search, series metadata)
- **Charts:** Recharts (spending dashboard)
- **CI:** GitHub Actions + Dependabot

## Features

- Email/password auth with JWT access + refresh tokens in httpOnly cookies
- Per-volume collection tracking: owned status, edition, price, purchase date
- Import a series from AniList — volumes are auto-created when AniList reports a
  fixed count; ongoing series are left for the user to add volumes to manually
- Create and manage custom series/volumes not on AniList
- Spending dashboard (total spent, monthly trend, top series by spend)
- Dark/light mode — follows OS preference when signed out, persists per account when
  signed in, with a one-click toggle
- Animated page transitions (Framer Motion)

## Running Locally

1. Clone and install dependencies:

   ```bash
   git clone <repo-url>
   cd your-shelve
   npm install
   ```

2. Copy `.env.example` to `.env` and fill in real values:

   ```bash
   cp .env.example .env
   ```

   Environment variables actually read by the app:

   | Variable | Required | Notes |
   |---|---|---|
   | `DATABASE_URL` | Yes | PostgreSQL connection string (Neon) |
   | `JWT_ACCESS_SECRET` | Yes | Signs access tokens |
   | `JWT_REFRESH_SECRET` | Yes | Signs refresh tokens (must differ from the access secret) |
   | `JWT_ACCESS_EXPIRES_IN` | No | Default `15m` |
   | `JWT_REFRESH_EXPIRES_IN` | No | Default `7d` |
   | `BCRYPT_SALT_ROUNDS` | No | Default `12` |
   | `CLOUDINARY_CLOUD_NAME` | Yes (for uploads) | Needed for cover image upload |
   | `CLOUDINARY_API_KEY` | Yes (for uploads) | |
   | `CLOUDINARY_API_SECRET` | Yes (for uploads) | |
   | `ANILIST_API_URL` | No | Default `https://graphql.anilist.co` |

3. Generate the Prisma client and run migrations:

   ```bash
   npx prisma generate
   npx prisma migrate dev
   ```

4. Start the dev server:

   ```bash
   npm run dev
   ```

5. Open [http://localhost:3000](http://localhost:3000).

## Security Testing

Security here isn't a list of "best practices we followed" — each case below was
handled the same way: write a script that actually attacks the running app,
confirm what really happens (not what the code is supposed to do), patch if it's
broken, then write up the before/after. The attack scripts live in `scripts/` and
are safe to re-run against a local dev server at any time — each one creates its own
throwaway test data and deletes it afterward.

### Case 1 — IDOR / BOLA (Insecure Direct Object Reference)

**Scenario:** `scripts/security-test-idor.mjs` registers two real accounts — User A
(victim) and User B (attacker) — has User A create a series, a volume, and an owned
collection entry with a real price, then, authenticated as User B (a valid account,
just not the owner), attempts to read, overwrite, or delete User A's data across 7
different endpoints using A's real resource IDs.

```
node scripts/security-test-idor.mjs
```

| Case | Test | Expected | Actual | Result |
|------|------|----------|--------|--------|
| a | GET /api/collections as B | 200, list does NOT contain A's volumeId or price | status 200, B's own item count=0, leaked=false | ✅ PASS |
| b | PUT /api/collections/{A's volumeId} as B | 200, writes a SEPARATE row owned by B (compound key), A's row (price/edition) unchanged | status 200, wroteAsB=true, differentRow=true, aStillIntact=true | ✅ PASS |
| c | DELETE /api/collections/{A's volumeId} as B | 204 (deletes only B's own row) or 404, A's row still intact afterward | status 204, aStillIntact=true | ✅ PASS |
| d | PATCH /api/series/{A's series} as B | 403, title unchanged | status 403, titleUnchanged=true | ✅ PASS |
| e | DELETE /api/series/{A's series} as B | 403, series still exists afterward | status 403, stillExists=true | ✅ PASS |
| f | POST /api/series/{A's series}/volumes as B | 403 (source=USER_CREATED, B is not createdById), and series still has exactly 1 volume (A's original) | status 403, volumes.length=1 | ✅ PASS |
| g | PATCH /api/users/me as B, body includes `"id"`: A's id | 200, only B's own profile changes (spoofed id ignored), A's profile untouched | status 200, touchedSelf=true, aUntouched=true | ✅ PASS |

**Why it holds:** every API route that touches personal data derives `userId` from
the verified JWT (`getCurrentUser(request)`) — never from a request body, query
param, or path segment — so there's no field an attacker can spoof to act as
someone else. `UserCollection` additionally enforces this at the database level via
`@@unique([userId, volumeId])`: a write from User B on User A's `volumeId` can only
ever create or update **B's own row**, since the compound key makes A's row simply
unaddressable by anyone else's `userId`.

### Case 2 — Rate Limiting / Brute-Force Protection

**Scenario:** `scripts/security-test-bruteforce.mjs` registers one account with a
known password, then fires 50 rapid `POST /api/auth/login` attempts — correct email,
a different wrong password every time — measuring how many go through before
anything blocks the attack, then tries the real password once to check whether the
account is (correctly) still locked out right after.

```
node scripts/security-test-bruteforce.mjs
```

| Metric | Before | After |
|---|---|---|
| First blocked attempt (of 50) | None — all 50 returned 401 | **Attempt 6** |
| Status code breakdown | `{"401":50}` | `{"401":5,"429":45}` |
| Average attack rate | 1.96 req/s | 16.24 req/s (mostly rejected before hashing) |
| Response time per attempt | ~500ms (483–548ms, bcrypt runs every time) | ~500ms for attempts 1–5, ~9–33ms for attempts 6–50 (mostly 10–15ms) |
| Real password, right after the attack | ✅ Logs in immediately | ❌ Still `429` — correct, not a bug |

**How it works:** `lib/security/rateLimit.ts` is an in-memory sliding-window
counter keyed on `"{ip}:{email}"` — IP alone would let an attacker spread guesses
across many accounts unnoticed; email alone would let a botnet spread guesses
across many IPs against one account. 5 wrong attempts in a 5-minute window blocks
further attempts with `429` + `Retry-After`, computed from a genuine sliding window
(the oldest failure aging out), not a fixed periodic reset. The status check
happens **before** password verification, so an already-blocked request never pays
for a bcrypt hash — which is also why blocked responses drop from ~500ms to ~9ms. A
successful login clears the counter for that key.

### Case 3 — Dependency Vulnerability Scanning

The `security-audit` job in `.github/workflows/ci.yml` runs `npm audit
--audit-level=high` on every push and pull request, via
`scripts/check-security-advisories.mjs`. It only fails the build on a high/critical
advisory that hasn't already been reviewed — advisories with a written
risk-acceptance entry in [`docs/SECURITY_ADVISORIES.md`](docs/SECURITY_ADVISORIES.md)
are logged but don't block CI. That distinction matters: it's a **documented
decision with reasoning**, not a suppressed warning — every accepted advisory has to
justify why patching now would cost more than the exposure it leaves. Dependabot
(`.github/dependabot.yml`, weekly npm scans) is what's expected to eventually
surface a real fix, at which point the entry gets removed from both the doc and the
script's allow-list.

### Known Limitations

- **Rate-limit key trusts `x-forwarded-for`.** Without a trusted reverse proxy in
  front of the app, this header can be spoofed, letting an attacker cycle through
  fake IPs to dodge the IP component of the rate-limit key. It's still effective at
  its main goal, though: the limit is scoped to `ip:email` together, so protecting
  one specific account doesn't depend on the IP half being trustworthy — an attacker
  spoofing IPs against the same email still trips the per-email side of the window.
- **Changing a password doesn't revoke previously-issued refresh tokens.** A refresh
  token issued before a password change stays valid until it expires on its own —
  see the `TODO(security)` in `app/api/users/me/password/route.ts`. Closing this
  properly needs session tracking (e.g. a per-user token version, or a
  refresh-token allow-list) that doesn't exist yet.

## Project Structure

```
app/
  api/            API routes (auth, series, collections, search, upload, users)
  account/        Account settings page
  dashboard/      Spending stats dashboard
  login/ register/  Auth pages
  series/         Series detail + create pages
  shelf/          User's collection page
  layout.tsx      Root layout — CSP nonce, theme init script, providers
components/
  discover/       Trending/search UI (MediaCard, SearchBar)
  layout/         NavBar, PageTransition
  series/         Series creation form
  shelf/          SeriesGroup, volume grid, edit modals
lib/
  auth/           JWT, password hashing, cookies, AuthContext
  security/       CSRF header check, rate limiter
  theme/          Dark/light mode ThemeContext
  hooks/          Client-side data-fetching hooks
  validation/     Zod schemas
  anilist.ts      AniList GraphQL client
  cloudinary.ts   Image upload client
  prisma.ts       Prisma client (Neon driver adapter)
prisma/
  schema.prisma   Database schema
  migrations/     Migration history
scripts/
  security-test-idor.mjs          Case 1 attack script
  security-test-bruteforce.mjs    Case 2 attack script
  check-security-advisories.mjs   Case 3 CI gate
docs/
  SECURITY_ADVISORIES.md   Accepted-risk log for npm audit findings
.github/
  workflows/ci.yml   CI: security-audit job
  dependabot.yml     Weekly npm dependency scans
```
