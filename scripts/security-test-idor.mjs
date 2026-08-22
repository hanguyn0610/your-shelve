// Security_Cases Case 1 — IDOR/BOLA red-team script.
//
// Standalone, plain-Node script (no test framework, no build step): run directly with
//   node scripts/security-test-idor.mjs
// against a running server at http://localhost:3000 (`npm run dev` or `npm run start`
// in another terminal first).
//
// Simulates an attacker who holds a perfectly valid account (User B) and tries to
// read, modify, or delete another user's (User A's) private data by reusing real
// resource IDs it has no business touching. It registers two fresh throwaway
// accounts over the real API, has User A create real data (a Series, a Volume, and an
// owned UserCollection row with a real price — the "sensitive" data this whole case
// is about protecting), then throws every IDOR angle in the task at it as User B.
//
// If every case behaves correctly, it prints a PASS/FAIL table (Markdown, so it can be
// pasted straight into a README) and deletes everything it created. If ANY case
// reveals a real vulnerability, it stops immediately, prints a detailed report, and
// deliberately leaves all the test data in the database as evidence — cleanup only
// happens on a full pass.

import { neon } from "@neondatabase/serverless";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const PROJECT_ROOT = join(__dirname, "..");

const BASE_URL = process.env.BASE_URL ?? "http://localhost:3000";
const CSRF_HEADERS = { "X-Requested-With": "XMLHttpRequest" };

// ---------------------------------------------------------------------------
// .env loading (DATABASE_URL only, for the cleanup step's direct SQL access) —
// no `dotenv` dependency, no CLI flags: this script is meant to run with a bare
// `node scripts/security-test-idor.mjs`, so it reads .env itself.
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
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
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
async function api(method, path, { token, body } = {}) {
  const headers = {};
  if (body !== undefined) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;
  // Every mutating request needs this — the app's CSRF defense-in-depth check
  // (lib/security/csrf.ts) 403s any POST/PUT/PATCH/DELETE without it, which would
  // otherwise mask the actual authorization result this script is trying to observe.
  if (method !== "GET") Object.assign(headers, CSRF_HEADERS);

  const response = await fetch(`${BASE_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await response.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // non-JSON response body — leave json as null, callers only check .status then
  }
  return { status: response.status, json };
}

// ---------------------------------------------------------------------------
// Result bookkeeping
// ---------------------------------------------------------------------------
const results = [];

function record(id, description, expected, actual, pass) {
  results.push({ id, description, expected, actual, pass });
  const icon = pass ? "PASS" : "FAIL";
  console.log(`  [${icon}] (${id}) ${description}`);
  console.log(`         expected: ${expected}`);
  console.log(`         actual:   ${actual}`);
}

function printMarkdownTable() {
  console.log("\n| Case | Test | Expected | Actual | Result |");
  console.log("|------|------|----------|--------|--------|");
  for (const r of results) {
    console.log(`| ${r.id} | ${r.description} | ${r.expected} | ${r.actual} | ${r.pass ? "✅ PASS" : "❌ FAIL"} |`);
  }
  console.log("");
}

function failAndStop(caseId, message, extra) {
  console.log("\n" + "=".repeat(78));
  console.log(`🚨 SECURITY TEST FAILED — case ${caseId}`);
  console.log("=".repeat(78));
  console.log(message);
  if (extra !== undefined) {
    console.log("Response detail:", JSON.stringify(extra, null, 2));
  }
  console.log("\nStopping immediately. Test data has been LEFT IN THE DATABASE as evidence");
  console.log("(User A/B accounts, the Series/Volume/Collection created above) — nothing");
  console.log("was cleaned up. Fix the vulnerability, then re-run this script; a clean run");
  console.log("does its own cleanup automatically.\n");
  printMarkdownTable();
  process.exit(1);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
async function main() {
  console.log(`Target: ${BASE_URL}`);
  try {
    await fetch(BASE_URL);
  } catch {
    console.error(`\nCould not reach ${BASE_URL}. Start the server first (npm run dev or npm run start).`);
    process.exit(1);
  }

  const stamp = Date.now();
  const seriesTitle = `IDOR Test Series ${stamp}`;
  const userA = { email: `idor-a-${stamp}@example.com`, password: "TestPass123!", displayName: "IDOR Victim A" };
  const userB = { email: `idor-b-${stamp}@example.com`, password: "TestPass123!", displayName: "IDOR Attacker B" };

  console.log("\n== Setup: registering User A (victim) and User B (attacker) ==");

  const regA = await api("POST", "/api/auth/register", { body: userA });
  if (regA.status !== 201 || !regA.json?.accessToken) {
    console.error(`Failed to register User A: status ${regA.status}`, regA.json);
    process.exit(1);
  }
  const tokenA = regA.json.accessToken;
  const userAId = regA.json.user.id;

  const regB = await api("POST", "/api/auth/register", { body: userB });
  if (regB.status !== 201 || !regB.json?.accessToken) {
    console.error(`Failed to register User B: status ${regB.status}`, regB.json);
    process.exit(1);
  }
  const tokenB = regB.json.accessToken;
  const userBId = regB.json.user.id;

  console.log(`  User A id=${userAId}`);
  console.log(`  User B id=${userBId}`);

  console.log("\n== Setup: User A creates a Series + Volume + owned collection with a real price ==");

  const createSeries = await api("POST", "/api/series", {
    token: tokenA,
    body: { title: seriesTitle, type: "MANGA", genres: [] },
  });
  if (createSeries.status !== 201) {
    console.error(`User A failed to create series: status ${createSeries.status}`, createSeries.json);
    process.exit(1);
  }
  const seriesId = createSeries.json.id;

  const createVolume = await api("POST", `/api/series/${seriesId}/volumes`, {
    token: tokenA,
    body: { volumeNumber: 1 },
  });
  if (createVolume.status !== 201) {
    console.error(`User A failed to create volume: status ${createVolume.status}`, createVolume.json);
    process.exit(1);
  }
  const volumeId = createVolume.json.id;

  // Prisma serializes Decimal fields as strings over JSON, and normalizes away
  // trailing zeros (e.g. 199000 comes back as "199000", not "199000.00") — compare
  // numerically below, never with a strict string match against a hardcoded literal.
  const SENSITIVE_PRICE = 199000;
  const setCollection = await api("PUT", `/api/collections/${volumeId}`, {
    token: tokenA,
    body: { owned: true, edition: "REGULAR", price: SENSITIVE_PRICE, purchaseDate: "2026-01-15" },
  });
  if (setCollection.status !== 200) {
    console.error(`User A failed to set collection: status ${setCollection.status}`, setCollection.json);
    process.exit(1);
  }
  const collectionId = setCollection.json.id;

  console.log(`  Series id=${seriesId} ("${seriesTitle}")`);
  console.log(`  Volume id=${volumeId}`);
  console.log(`  Collection id=${collectionId}, price=${SENSITIVE_PRICE} (this is the "sensitive" data under test)`);

  console.log("\n== Attack: User B (valid account, not the owner) attempts every IDOR angle ==\n");

  // a. GET /api/collections as B — must never surface A's data
  {
    const res = await api("GET", "/api/collections", { token: tokenB });
    const items = res.json?.items ?? [];
    const leaked = items.some((item) => item.volumeId === volumeId || Number(item.price) === SENSITIVE_PRICE);
    const pass = res.status === 200 && !leaked;
    record(
      "a",
      "GET /api/collections as B",
      "200, list does NOT contain A's volumeId or price",
      `status ${res.status}, B's own item count=${items.length}, leaked=${leaked}`,
      pass,
    );
    if (!pass) failAndStop("a", "User B's own collection list leaked User A's volumeId/price.", res.json);
  }

  // b. PUT /api/collections/{A's volumeId} as B — must write B's OWN row (compound
  // key), never touch A's row.
  {
    const res = await api("PUT", `/api/collections/${volumeId}`, {
      token: tokenB,
      body: { owned: true, edition: "COLLECTOR", price: 1, purchaseDate: "2020-01-01" },
    });
    const wroteAsB = res.json?.userId === userBId;
    const differentRow = res.json?.id !== collectionId;

    const verifyA = await api("GET", "/api/collections", { token: tokenA });
    const aRow = (verifyA.json?.items ?? []).find((item) => item.id === collectionId);
    const aStillIntact = !!aRow && aRow.volumeId === volumeId && Number(aRow.price) === SENSITIVE_PRICE && aRow.edition === "REGULAR";

    const pass = res.status === 200 && wroteAsB && differentRow && aStillIntact;
    record(
      "b",
      "PUT /api/collections/{A's volumeId} as B",
      "200, writes a SEPARATE row owned by B (compound key), A's row (price/edition) unchanged",
      `status ${res.status}, wroteAsB=${wroteAsB}, differentRow=${differentRow}, aStillIntact=${aStillIntact}`,
      pass,
    );
    if (!pass) {
      failAndStop("b", "User B's write on A's volumeId either touched A's row or didn't create B's own row correctly.", {
        bResponse: res.json,
        aRowAfterward: aRow ?? null,
      });
    }
  }

  // c. DELETE /api/collections/{A's volumeId} as B — only ever removes B's own row
  // (created in case b above), never A's.
  {
    const res = await api("DELETE", `/api/collections/${volumeId}`, { token: tokenB });

    const verifyA = await api("GET", "/api/collections", { token: tokenA });
    const aRow = (verifyA.json?.items ?? []).find((item) => item.id === collectionId);
    const aStillIntact = !!aRow && Number(aRow.price) === SENSITIVE_PRICE;

    const pass = (res.status === 204 || res.status === 404) && aStillIntact;
    record(
      "c",
      "DELETE /api/collections/{A's volumeId} as B",
      "204 (deletes only B's own row) or 404, A's row still intact afterward",
      `status ${res.status}, aStillIntact=${aStillIntact}`,
      pass,
    );
    if (!pass) failAndStop("c", "User B's DELETE on A's volumeId affected User A's collection row.", { aRowAfterward: aRow ?? null });
  }

  // d. PATCH /api/series/{A's series} as B — must 403, title unchanged
  {
    const res = await api("PATCH", `/api/series/${seriesId}`, { token: tokenB, body: { title: "Hacked by B" } });
    const verify = await api("GET", `/api/series/${seriesId}`);
    const titleUnchanged = verify.json?.title === seriesTitle;
    const pass = res.status === 403 && titleUnchanged;
    record(
      "d",
      "PATCH /api/series/{A's series} as B",
      "403, title unchanged",
      `status ${res.status}, titleUnchanged=${titleUnchanged} (now "${verify.json?.title}")`,
      pass,
    );
    if (!pass) failAndStop("d", "User B was able to modify User A's series.", res.json);
  }

  // e. DELETE /api/series/{A's series} as B — must 403, series still exists
  {
    const res = await api("DELETE", `/api/series/${seriesId}`, { token: tokenB });
    const verify = await api("GET", `/api/series/${seriesId}`);
    const stillExists = verify.status === 200;
    const pass = res.status === 403 && stillExists;
    record(
      "e",
      "DELETE /api/series/{A's series} as B",
      "403, series still exists afterward",
      `status ${res.status}, stillExists=${stillExists}`,
      pass,
    );
    if (!pass) failAndStop("e", "User B was able to delete User A's series.", res.json);
  }

  // f. POST /api/series/{A's series}/volumes as B — must 403 (USER_CREATED, B not owner),
  // AND no volume must have actually been created despite the 403 (belt-and-suspenders
  // check — a 403 response is only meaningful if nothing was written behind it).
  {
    const res = await api("POST", `/api/series/${seriesId}/volumes`, { token: tokenB, body: { volumeNumber: 2 } });

    const verify = await api("GET", `/api/series/${seriesId}`);
    const volumeCount = verify.json?.volumes?.length;
    const noVolumeCreated = volumeCount === 1;

    const pass = res.status === 403 && noVolumeCreated;
    record(
      "f",
      "POST /api/series/{A's series}/volumes as B",
      "403 (source=USER_CREATED, B is not createdById), and series still has exactly 1 volume (A's original)",
      `status ${res.status}, volumes.length=${volumeCount}`,
      pass,
    );
    if (!pass) {
      failAndStop("f", "User B was able to add a volume to User A's USER_CREATED series (either the 403 didn't fire, or a volume leaked through despite it).", {
        postResponse: res.json,
        seriesVolumesAfterward: verify.json?.volumes,
      });
    }
  }

  // g. PATCH /api/users/me as B with a spoofed "id" field pointing at A — mass
  // assignment must not let the body's id override the token-derived user.
  {
    const spoofedName = `Spoofed-By-B-${stamp}`;
    const res = await api("PATCH", "/api/users/me", { token: tokenB, body: { id: userAId, displayName: spoofedName } });
    const touchedSelf = res.json?.user?.id === userBId && res.json?.user?.displayName === spoofedName;

    const verifyA = await api("GET", "/api/auth/me", { token: tokenA });
    const aUntouched = verifyA.json?.user?.displayName === userA.displayName;

    const pass = res.status === 200 && touchedSelf && aUntouched;
    record(
      "g",
      'PATCH /api/users/me as B, body includes "id": A\'s id',
      "200, only B's own profile changes (spoofed id ignored), A's profile untouched",
      `status ${res.status}, touchedSelf=${touchedSelf}, aUntouched=${aUntouched}`,
      pass,
    );
    if (!pass) failAndStop("g", "Mass-assignment via a spoofed \"id\" field in the request body succeeded.", res.json);
  }

  console.log("\n== All cases passed — no IDOR/BOLA vulnerability found ==");
  printMarkdownTable();

  console.log("== Cleanup ==");
  const databaseUrl = loadDatabaseUrlFromEnvFile();
  if (!databaseUrl) {
    console.warn("Could not find DATABASE_URL (checked process.env and .env) — skipping cleanup.");
    console.warn(`Clean up manually: Series id=${seriesId}, User A id=${userAId}, User B id=${userBId}`);
    return;
  }

  try {
    const sql = neon(databaseUrl);
    // Deleting the Series cascades to its Volumes, which cascades to any
    // UserCollection rows on those volumes (covers A's original row and any
    // leftover row from B's IDOR attempts). Series.createdBy uses onDelete: SetNull,
    // not Cascade, so this has to happen explicitly — deleting the Users alone would
    // NOT remove the Series, only orphan it.
    await sql`DELETE FROM "Series" WHERE id = ${seriesId}`;
    // Deleting the Users cascades any of their remaining UserCollection rows.
    await sql`DELETE FROM "User" WHERE id IN (${userAId}, ${userBId})`;
    console.log("  Deleted: Series (cascaded Volume + UserCollection rows), User A, User B.");
    console.log("Cleanup complete — no test data left behind.");
  } catch (error) {
    console.error("Cleanup failed:", error instanceof Error ? error.message : error);
    console.error(`Clean up manually: Series id=${seriesId}, User A id=${userAId}, User B id=${userBId}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("\nUnexpected script error:", error);
  process.exit(1);
});
