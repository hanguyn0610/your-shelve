// Decodes a JWT payload without verifying its signature. Only safe to use on a token
// we just signed ourselves (e.g. reading `exp` to compute a cookie's maxAge in
// setAuthCookies.ts) — never to authenticate a token that came from a request.
// Real signature verification always happens via verifyAccessToken/getCurrentUser.
export function decodeJwtPayload<T>(token: string): T | null {
  const parts = token.split(".");
  const payloadSegment = parts[1];
  if (parts.length !== 3 || !payloadSegment) return null;

  try {
    const base64 = payloadSegment.replace(/-/g, "+").replace(/_/g, "/");
    const padded = base64 + "=".repeat((4 - (base64.length % 4)) % 4);
    return JSON.parse(atob(padded)) as T;
  } catch {
    return null;
  }
}
