import type { NextResponse } from "next/server";
import { ACCESS_TOKEN_COOKIE, REFRESH_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { decodeJwtPayload } from "@/lib/auth/decodeJwt";

function maxAgeFromToken(token: string): number | undefined {
  const exp = decodeJwtPayload<{ exp?: number }>(token)?.exp;
  return exp ? Math.max(0, exp - Math.floor(Date.now() / 1000)) : undefined;
}

export function setAuthCookies(response: NextResponse, accessToken: string, refreshToken: string): void {
  const baseOptions = {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
  };

  response.cookies.set(ACCESS_TOKEN_COOKIE, accessToken, { ...baseOptions, maxAge: maxAgeFromToken(accessToken) });
  response.cookies.set(REFRESH_TOKEN_COOKIE, refreshToken, { ...baseOptions, maxAge: maxAgeFromToken(refreshToken) });
}
