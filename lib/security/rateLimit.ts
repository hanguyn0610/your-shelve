// In-memory, per-instance sliding-window failure tracker (Security_Cases Case 2 —
// brute-force protection for /api/auth/login). Same "just a Map, no external store"
// approach as lib/cache.ts (Ngày 6), but counting FAILURES within a rolling time
// window instead of caching a fetched value.
//
// Data is lost on restart, and each server instance tracks its own counts
// independently — no cross-instance sync. Fine for a single-instance MVP; scaling to
// multiple instances/serverless would let an attacker just get a fresh allowance from
// whichever instance happens to answer their next request, so that setup needs a
// shared store (e.g. Redis) instead.
const failuresByKey = new Map<string, number[]>();

export interface RateLimitResult {
  allowed: boolean;
  // Only set when allowed is false — milliseconds until the oldest failure inside
  // the window ages out and the key becomes allowed again.
  retryAfterMs?: number;
}

// Drops timestamps that have aged out of the window, updates the map accordingly (or
// removes the key entirely once nothing's left, so a key that's never retried doesn't
// keep an empty array around forever), and returns what's still in the window.
function pruneToWindow(key: string, windowMs: number): number[] {
  const now = Date.now();
  const existing = failuresByKey.get(key);
  if (!existing) return [];

  const withinWindow = existing.filter((timestamp) => now - timestamp < windowMs);
  if (withinWindow.length > 0) {
    failuresByKey.set(key, withinWindow);
  } else {
    failuresByKey.delete(key);
  }
  return withinWindow;
}

function evaluate(timestamps: number[], maxAttempts: number, windowMs: number): RateLimitResult {
  if (timestamps.length < maxAttempts) {
    return { allowed: true };
  }
  // A genuine sliding window, not a fixed periodic reset — blocked until the OLDEST
  // failure inside the window ages out, so an attacker can't just wait for the top of
  // a clock tick and burst again. timestamps.length >= maxAttempts (>= 1) here, so
  // index 0 always exists — the fallback only satisfies noUncheckedIndexedAccess.
  const oldest = timestamps[0] ?? Date.now();
  const retryAfterMs = Math.max(0, windowMs - (Date.now() - oldest));
  return { allowed: false, retryAfterMs };
}

// Read-only status check — prunes expired entries and reports whether `key` is
// currently allowed, WITHOUT recording a new failure. Call this before doing any
// expensive verification (e.g. password hashing), for two reasons: an already-blocked
// caller gets rejected without paying that cost, and a single failed attempt never
// gets double-counted by also being recorded here.
export function getRateLimitStatus(key: string, maxAttempts: number, windowMs: number): RateLimitResult {
  return evaluate(pruneToWindow(key, windowMs), maxAttempts, windowMs);
}

// Records one failure for `key` and returns whether it's still allowed afterward.
// Call this only when an attempt genuinely fails (never speculatively) — calling it
// on every request regardless of outcome would count successful logins as failures.
export function checkAndRecordFailure(key: string, maxAttempts: number, windowMs: number): RateLimitResult {
  const timestamps = pruneToWindow(key, windowMs);
  timestamps.push(Date.now());
  failuresByKey.set(key, timestamps);
  return evaluate(timestamps, maxAttempts, windowMs);
}

// Called on a SUCCESSFUL login — clears the failure count for `key` so a user who
// mistypes their password once or twice before getting it right isn't left one
// mistake away from a lockout on their next legitimate attempt.
export function resetKey(key: string): void {
  failuresByKey.delete(key);
}
