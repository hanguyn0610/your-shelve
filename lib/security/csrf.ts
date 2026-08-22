const CSRF_HEADER_NAME = "x-requested-with";
const CSRF_HEADER_VALUE = "XMLHttpRequest";

// Exported so every client-side fetch() call can build its headers from the same
// constants instead of re-typing the literal string (and risking a typo that would
// silently fail the check below).
export const CSRF_HEADER = { [CSRF_HEADER_NAME]: CSRF_HEADER_VALUE } as const;

// Defense-in-depth against CSRF — NOT a replacement for the sameSite=lax cookie set in
// lib/auth/setAuthCookies.ts (Day 7), which stays the primary defense. This adds a
// second, independent check: a browser refuses to let a cross-origin HTML <form> (the
// classic forged-request vector) set custom headers, so only same-origin JS using
// fetch()/XHR can ever attach this header. Call this from every route that mutates
// data (POST/PUT/PATCH/DELETE) — see the API routes under app/api for the call sites.
export function requireCsrfHeader(request: Request): boolean {
  return request.headers.get(CSRF_HEADER_NAME) === CSRF_HEADER_VALUE;
}
