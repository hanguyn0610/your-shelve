import { verifyAccessToken } from "@/lib/auth/jwt";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/cookies";

function getTokenFromCookieHeader(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return null;

  for (const part of cookieHeader.split(";")) {
    const separatorIndex = part.indexOf("=");
    if (separatorIndex === -1) continue;

    const name = part.slice(0, separatorIndex).trim();
    if (name !== ACCESS_TOKEN_COOKIE) continue;

    const value = part.slice(separatorIndex + 1).trim();
    try {
      return decodeURIComponent(value);
    } catch {
      return value;
    }
  }
  return null;
}

function getTokenFromAuthHeader(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  return scheme === "Bearer" && token ? token : null;
}

export function getCurrentUser(request: Request): string | null {
  // Browser requests carry the httpOnly cookie automatically; a bare Authorization
  // header remains the fallback for curl/Postman/non-browser callers.
  const token = getTokenFromCookieHeader(request) ?? getTokenFromAuthHeader(request);
  if (!token) return null;

  const payload = verifyAccessToken(token);
  return payload?.userId ?? null;
}
