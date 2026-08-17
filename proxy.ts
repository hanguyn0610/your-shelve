import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";

export function proxy(request: NextRequest) {
  const token = request.cookies.get(ACCESS_TOKEN_COOKIE)?.value;

  // Since Next.js 16, Proxy (formerly "middleware") defaults to the Node.js runtime —
  // no more Edge/Node-crypto restriction — so this verifies the real signature via
  // the same verifyAccessToken() every data-touching API route uses, instead of only
  // decoding the payload. This is now an actual security boundary, not just UX routing.
  const isValid = !!token && !!verifyAccessToken(token);

  if (!isValid) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("redirectTo", request.nextUrl.pathname);
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ["/shelf/:path*", "/account/:path*"],
};
