import { verifyAccessToken } from "@/lib/auth/jwt";

export function getCurrentUser(request: Request): string | null {
  const authHeader = request.headers.get("authorization");
  if (!authHeader) return null;

  const [scheme, token] = authHeader.split(" ");
  if (scheme !== "Bearer" || !token) return null;

  const payload = verifyAccessToken(token);
  return payload?.userId ?? null;
}
