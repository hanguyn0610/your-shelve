import { NextResponse, type NextRequest } from "next/server";
import { ACCESS_TOKEN_COOKIE } from "@/lib/auth/cookies";
import { verifyAccessToken } from "@/lib/auth/jwt";

const PROTECTED_PATH_PREFIXES = ["/shelf", "/account", "/dashboard"];

function isProtectedPath(pathname: string): boolean {
  return PROTECTED_PATH_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function proxy(request: NextRequest) {
  // --- Auth guard for protected pages (unchanged from before — just scoped to a path
  // check now that the matcher below covers every page, not only these three). ---
  if (isProtectedPath(request.nextUrl.pathname)) {
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
  }

  // --- Content-Security-Policy, per Next.js's own recommended App Router pattern:
  // a fresh nonce generated here on every request, threaded through so both the
  // response header and any nonce-aware inline script agree on the same value. ---
  const nonce = Buffer.from(crypto.randomUUID()).toString("base64");

  // Next.js's own dev-mode tooling (Fast Refresh/HMR, React DevTools instrumentation)
  // calls eval() internally — under a strict script-src that shows up as a console
  // "eval() is not supported" error while running `npm run dev`, purely because CSP
  // blocked it, not a real app bug. 'unsafe-eval' is added ONLY when NODE_ENV is
  // "development"; `next build`/`next start` (and any real deploy, which always runs
  // with NODE_ENV=production) still get the strict script-src below with no
  // 'unsafe-eval' at all — eval() is never needed there in the first place.
  const isDevelopment = process.env.NODE_ENV === "development";
  const scriptSrc = isDevelopment
    ? `'self' 'nonce-${nonce}' 'strict-dynamic' 'unsafe-eval'`
    : `'self' 'nonce-${nonce}' 'strict-dynamic'`;

  const cspHeader = `
    default-src 'self';
    script-src ${scriptSrc};
    style-src 'self' 'unsafe-inline';
    img-src 'self' data: https://*.anilist.co https://res.cloudinary.com;
    font-src 'self';
    connect-src 'self';
    object-src 'none';
    base-uri 'self';
    form-action 'self';
    frame-ancestors 'none';
  `;
  // upgrade-insecure-requests deliberately omitted (unlike Next.js's own docs example):
  // it makes the browser rewrite same-origin http:// requests to https:// even when the
  // page itself was served over plain http — verified live that this breaks Next's own
  // link-prefetching (net::ERR_SSL_PROTOCOL_ERROR) on a plain-HTTP origin like local dev
  // or any deployment without its own TLS termination in front of Next. A production
  // deploy behind HTTPS doesn't need this directive to already be all-HTTPS.
  // script-src: 'nonce-{nonce}' + 'strict-dynamic' is the App Router pattern Next.js
  // itself recommends — the nonce authorizes Next's own inline hydration script, and
  // 'strict-dynamic' lets that trusted script load its own children without needing
  // every chunk allow-listed individually. No 'unsafe-inline', and no 'unsafe-eval'
  // in production — see the isDevelopment branch above for the dev-only exception.
  //
  // img-src: 'self' (locally-served assets) + data: (inline data URIs, e.g. blur
  // placeholders) + the two remote hosts actually used — s*.anilist.co for AniList
  // cover art and res.cloudinary.com for user-uploaded covers — matching
  // next.config.ts's images.remotePatterns exactly, nothing broader.
  //
  // connect-src 'self': the browser never talks to AniList or Cloudinary directly —
  // every such call goes through this app's own /api/* routes (see lib/anilist.ts,
  // lib/cloudinary.ts), so same-origin is all fetch()/XHR ever needs here.
  //
  // frame-ancestors 'none': this app is never meant to be embedded in someone else's
  // <iframe> — this is the CSP-level, modern replacement for X-Frame-Options: DENY.
  const contentSecurityPolicy = cspHeader.replace(/\s{2,}/g, " ").trim();

  const requestHeaders = new Headers(request.headers);
  requestHeaders.set("x-nonce", nonce);
  requestHeaders.set("Content-Security-Policy", contentSecurityPolicy);

  const response = NextResponse.next({ request: { headers: requestHeaders } });
  response.headers.set("Content-Security-Policy", contentSecurityPolicy);
  return response;
}

export const config = {
  matcher: [
    // Every page request except API routes, Next's own static/image assets, and
    // favicon.ico — those don't render HTML/script and don't need a CSP header.
    "/((?!api|_next/static|_next/image|favicon.ico).*)",
  ],
};
