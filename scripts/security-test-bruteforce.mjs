// Security_Cases Case 2 — Rate limiting / Brute-force red-team script.
//
// Standalone, plain-Node script (no test framework, no build step, same style as
// scripts/security-test-idor.mjs): run directly with
//   node scripts/security-test-bruteforce.mjs
// against a running server at http://localhost:3000 (`npm run dev` or `npm run start`
// in another terminal first).
//
// Simulates a brute-force attacker: registers one throwaway "victim" account with a
// known real password, then fires 50 rapid-fire POST /api/auth/login attempts — correct
// email, a WRONG password every time (each one provably unique, never repeating) —
// measuring whether/when the server starts throttling or locking the account out.
// Afterward it tries the REAL password once: if the account is still temporarily
// locked out even for its rightful owner, that is CORRECT rate-limiting behavior, not
// a bug — a real attacker shouldn't be able to brute-force in unlimited attempts
// either way.
//
// This script only MEASURES the current behavior. It does not patch anything.

import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { neon } from "@neondatabase/serverless";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const CSRF_HEADERS = { "X-Requested-With": "XMLHttpRequest" };
const ATTEMPT_COUNT = 50;

// ---------------------------------------------------------------------------
// .env loading (DATABASE_URL only, for the cleanup step's direct SQL access) —
// no `dotenv` dependency, no CLI flags: this script runs with a bare
// `node scripts/security-test-bruteforce.mjs`, so it reads .env itself.
// ---------------------------------------------------------------------------
function loadDatabaseUrlFromEnvFile() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    const content = readFileSync(join(PROJECT_ROOT, ".env"), "utf8");
    for (const line of content.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith("#")) continue;
      const eq = trimmed.indexOf("=");
      if (eq === -1) continue;
      const key = trimmed.slice(0, eq).trim();
      if (key !== "DATABASE_URL") continue;
      let value = trimmed.slice(eq + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      return value;
    }
  } catch {
    // fall through to the error below
  }
  return null;
}

// ---------------------------------------------------------------------------
// Tiny HTTP helper
// ---------------------------------------------------------------------------
async function api(method, path, { body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  // The app's CSRF defense-in-depth check (lib/security/csrf.ts) 403s any
  // POST/PUT/PATCH/DELETE without this header — required here so the status codes
  // measured below reflect the actual auth/rate-limit path, not a CSRF rejection.
  if (method !== "GET") Object.assign(headers, CSRF_HEADERS);

  const start = Date.now();
  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const elapsedMs = Date.now() - start;

  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON response body — leave json as null
  }
  return { status: response.status, json, elapsedMs };
}

// A different, never-repeated wrong password per attempt — the index alone makes
// each one provably unique across the run, with no chance of accidentally matching
// the real password.
function wrongPasswordFor(attemptIndex) {
  return `WrongPass-${attemptIndex}-${Math.random().toString(36).slice(2, 10)}!`;
}

async function main() {
  console.log(`Target: ${BASE_URL}`);
  try {
    await fetch(BASE_URL);
  } catch {
    console.error(`\nCould not reach ${BASE_URL}. Start the server first (npm run dev or npm run start).`);
    process.exit(1);
  }

  const stamp = Date.now();
  const email = `bruteforce-${stamp}@example.com`;
  const realPassword = "RealPass123!";
  const displayName = "Brute Force Victim";

  console.log("\n== Setup: registering victim account with a known real password ==");
  const reg = await api("POST", "/api/auth/register", { body: { email, password: realPassword, displayName } });
  if (reg.status !== 201 || !reg.json?.user?.id) {
    console.error(`Failed to register victim account: status ${reg.status}`, reg.json);
    process.exit(1);
  }
  const userId = reg.json.user.id;
  console.log(`  User id=${userId}, email=${email}`);

  console.log(`\n== Attack: ${ATTEMPT_COUNT} rapid-fire POST /api/auth/login attempts (correct email, wrong password each time) ==\n`);

  const attempts = [];
  let firstBlockedAt = null;
  const attackStart = Date.now();

  for (let i = 1; i <= ATTEMPT_COUNT; i++) {
    const res = await api("POST", "/api/auth/login", { body: { email, password: wrongPasswordFor(i) } });
    attempts.push({ attempt: i, status: res.status, elapsedMs: res.elapsedMs });

    // 401 (bad credentials) is the normal, expected outcome for a wrong password.
    // Anything else — 429 (rate limited), a 5xx, a sudden 200 (shouldn't happen with
    // a wrong password), etc. — is the server visibly reacting to the attack pattern.
    const isBlocked = res.status !== 401;
    if (isBlocked && firstBlockedAt === null) {
      firstBlockedAt = i;
    }

    if (i <= 5 || i % 10 === 0 || isBlocked) {
      console.log(`  attempt ${i}/${ATTEMPT_COUNT}: status ${res.status}${isBlocked ? "  <-- not a plain 401" : ""} (${res.elapsedMs}ms)`);
    }
  }

  const attackElapsedMs = Date.now() - attackStart;
  const requestsPerSecond = ATTEMPT_COUNT / (attackElapsedMs / 1000);

  const statusCounts = {};
  for (const a of attempts) {
    statusCounts[a.status] = (statusCounts[a.status] ?? 0) + 1;
  }

  console.log("\n== Attempt summary ==");
  console.log(`  Total requests sent:    ${ATTEMPT_COUNT}`);
  console.log(`  Total time:             ${attackElapsedMs}ms`);
  console.log(`  Average rate:           ${requestsPerSecond.toFixed(2)} req/s`);
  console.log(`  Status code breakdown:  ${JSON.stringify(statusCounts)}`);
  console.log(`  First blocked attempt:  ${firstBlockedAt ?? "NONE — all 50 attempts went through unthrottled"}`);

  console.log("\n== Follow-up: trying the REAL password right after the attack ==");
  const realAttempt = await api("POST", "/api/auth/login", { body: { email, password: realPassword } });
  const realLoginSucceeded = realAttempt.status === 200;
  console.log(`  status ${realAttempt.status} -> ${realLoginSucceeded ? "logged in successfully" : "rejected even with the correct password"}`);
  if (!realLoginSucceeded && firstBlockedAt !== null) {
    console.log("  (A temporary lockout here, right after 50 failed attempts, is CORRECT rate-limiting");
    console.log("   behavior — not a bug. A real attacker shouldn't get unlimited guesses either.)");
  } else if (!realLoginSucceeded && firstBlockedAt === null) {
    console.log("  (Unexpected: nothing blocked the 50 wrong attempts, yet the correct password also");
    console.log("   failed — this looks like a separate bug, not rate-limiting. Investigate directly.)");
  }

  console.log("\n" + "=".repeat(78));
  const isVulnerable = firstBlockedAt === null;
  if (isVulnerable) {
    console.log("🚨 CÓ LỖ HỔNG BRUTE-FORCE");
    console.log(`Toàn bộ ${ATTEMPT_COUNT} lần đăng nhập sai liên tiếp đều nhận HTTP 401 bình thường —`);
    console.log("không có giới hạn tốc độ (rate-limit) hay khoá tạm thời nào được kích hoạt.");
    console.log(`Tốc độ tấn công đo được: ${requestsPerSecond.toFixed(2)} request/giây, không hề bị chặn.`);
    console.log('Xem CLAUDE.md — "API login PHẢI có rate-limit theo IP/email" (Security_Cases, Case 2) — chưa được áp dụng.');
  } else {
    console.log("✅ ĐÃ ĐƯỢC BẢO VỆ");
    console.log(`Request thứ ${firstBlockedAt}/${ATTEMPT_COUNT} bắt đầu nhận status khác 401 (bị chặn).`);
    console.log(`Tốc độ tấn công đo được trước khi bị chặn: ${requestsPerSecond.toFixed(2)} request/giây.`);
  }
  console.log("=".repeat(78));

  console.log("\n== Cleanup ==");
  const databaseUrl = loadDatabaseUrlFromEnvFile();
  if (!databaseUrl) {
    console.warn("Could not find DATABASE_URL (checked process.env and .env) — skipping cleanup.");
    console.warn(`Clean up manually: User id=${userId}, email=${email}`);
    return;
  }

  try {
    const sql = neon(databaseUrl);
    await sql`DELETE FROM "User" WHERE id = ${userId}`;
    console.log(`  Deleted victim account (id=${userId}).`);
    console.log("Cleanup complete — no test data left behind.");
  } catch (error) {
    console.error("Cleanup failed:", error instanceof Error ? error.message : error);
    console.error(`Clean up manually: User id=${userId}, email=${email}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\nUnexpected script error:", error);
  process.exit(1);
});
