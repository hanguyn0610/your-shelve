// Security_Cases Case 3 — CI gate for `npm audit`.
//
// Runs `npm audit --audit-level=high --json`, extracts every GHSA advisory id it
// reports, and compares that list against the advisories this project has formally
// reviewed and accepted the risk on (see docs/SECURITY_ADVISORIES.md — the
// ACCEPTED_ADVISORIES list below MUST be kept in sync with that document by hand).
//
// Any high/critical advisory that ISN'T on the accepted list fails this script (and
// therefore the CI job that runs it). Already-reviewed advisories are logged but
// don't fail the build — accepting a risk should be visible in every run, not silent.
//
// Runnable standalone: `node scripts/check-security-advisories.mjs`

import { spawnSync } from "node:child_process";

// Keep this in sync with docs/SECURITY_ADVISORIES.md — every id here must have a
// matching entry there explaining WHY it's accepted, and vice versa.
const ACCEPTED_ADVISORIES = new Set([
  // deepmerge-ts stack exhaustion, reached via deepmerge-ts -> @prisma/config ->
  // prisma (the CLI package) — dev-only tooling, never in the production runtime
  // path (lib/prisma.ts imports @prisma/client directly, a separate package).
  "GHSA-ggr8-5vv4-36mx",
]);

function extractAdvisoryIds(auditJson) {
  const ids = new Set();
  const vulnerabilities = auditJson.vulnerabilities ?? {};
  for (const entry of Object.values(vulnerabilities)) {
    for (const via of entry.via ?? []) {
      // `via` mixes plain package-name strings (just naming the parent dependency)
      // with advisory detail objects — only the objects carry a `url` to parse.
      if (typeof via !== "object" || !via.url) continue;
      const match = /\/advisories\/(GHSA-[a-z0-9-]+)/i.exec(via.url);
      if (match) ids.add(match[1]);
    }
  }
  return ids;
}

function main() {
  // A single full command string with shell:true and no separate args array — needed
  // for "npm" to resolve at all on Windows (it's npm.cmd, not directly on PATH the
  // way spawnSync looks for executables), without the DEP0190 warning that shell:true
  // + an args array triggers (that combination unescaped-concatenates the args).
  // There's no untrusted input here — the whole command is a fixed literal.
  const result = spawnSync("npm audit --audit-level=high --json", {
    encoding: "utf8",
    shell: true,
    // npm audit exits non-zero when it finds vulnerabilities at/above the threshold
    // — expected here. The JSON on stdout is what matters, regardless of exit code.
  });

  if (!result.stdout) {
    console.error("`npm audit` produced no output.");
    if (result.stderr) console.error(result.stderr);
    process.exit(1);
  }

  let auditJson;
  try {
    auditJson = JSON.parse(result.stdout);
  } catch (error) {
    console.error("Failed to parse `npm audit --json` output:", error instanceof Error ? error.message : error);
    console.error(result.stdout);
    process.exit(1);
  }

  const foundIds = [...extractAdvisoryIds(auditJson)].sort();
  const known = foundIds.filter((id) => ACCEPTED_ADVISORIES.has(id));
  const unknown = foundIds.filter((id) => !ACCEPTED_ADVISORIES.has(id));

  console.log(
    `${known.length} known/accepted advisories (see docs/SECURITY_ADVISORIES.md), ${unknown.length} new advisories requiring attention`,
  );

  if (known.length > 0) {
    console.log("\nKnown/accepted:");
    for (const id of known) console.log(`  - ${id}`);
  }

  if (unknown.length > 0) {
    console.log("\nNEW / not yet reviewed:");
    for (const id of unknown) console.log(`  - ${id} — https://github.com/advisories/${id}`);
    console.log(
      "\nReview these, then either patch them or add a formal risk-acceptance entry to " +
        "docs/SECURITY_ADVISORIES.md (and this script's ACCEPTED_ADVISORIES list) before merging.",
    );
    process.exit(1);
  }

  console.log("\nAll high/critical advisories are already reviewed and accepted. Passing.");
}

main();
