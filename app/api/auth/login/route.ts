import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCsrfHeader } from "@/lib/security/csrf";
import { checkAndRecordFailure, getRateLimitStatus, resetKey } from "@/lib/security/rateLimit";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/setAuthCookies";

// Hash of an unused fixed string. Compared against when no user is found so that a
// missing email doesn't respond faster than a wrong password (timing side-channel).
const DUMMY_HASH = "$2b$12$wI1VLiYydpVZpHhBiiiwdOavBLsJEEHa0idgam7Bw20wg0ay1WpHu"; // Hash of an unused fixed string, generated with the SAME cost factor as
// BCRYPT_SALT_ROUNDS (12) so real vs. non-existent users take equal time to verify.

const INVALID_CREDENTIALS_MESSAGE = "Email hoặc mật khẩu không đúng";

// Security_Cases Case 2 — brute-force protection. Keyed on IP + email together (not
// either alone): IP-only would let an attacker spread guesses across many accounts
// from one IP without ever tripping a per-account limit; email-only would let a
// botnet spread guesses across many IPs against the same account. 5 wrong attempts
// per 5-minute sliding window is deliberately tight for an MVP — revisit if it turns
// out to bite real users who just fat-finger their password a few times.
const MAX_LOGIN_ATTEMPTS = 5;
const LOGIN_WINDOW_MS = 5 * 60 * 1000;

function getClientIp(request: Request): string {
  // The app doesn't sit behind a proxy that's guaranteed to set this in every
  // environment (e.g. plain `next dev`/`next start` on localhost never will) — falling
  // back to a fixed "unknown" bucket means every such request shares one rate-limit
  // key, which is strictly more restrictive than not rate-limiting IP at all, not less.
  const forwardedFor = request.headers.get("x-forwarded-for");
  return forwardedFor?.split(",")[0]?.trim() || "unknown";
}

export async function POST(request: Request) {
  // This route doesn't require a signed-in session, so the CSRF check goes here at the
  // very top instead of "right after the auth check" like the other routes.
  if (!requireCsrfHeader(request)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = loginSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { password } = parsed.data;
  const rateLimitKey = `${getClientIp(request)}:${email}`;

  // Read-only check first — rejects an already-locked-out caller before paying for a
  // bcrypt hash, and deliberately does NOT record a failure itself (see
  // lib/security/rateLimit.ts): that only happens below, once, after we actually know
  // this specific attempt failed.
  const status = getRateLimitStatus(rateLimitKey, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_MS);
  if (!status.allowed) {
    const retryAfterSeconds = Math.ceil((status.retryAfterMs ?? 0) / 1000);
    return NextResponse.json(
      { error: `Quá nhiều lần đăng nhập sai, vui lòng thử lại sau ${retryAfterSeconds} giây` },
      { status: 429, headers: { "Retry-After": String(retryAfterSeconds) } },
    );
  }

  const user = await prisma.user.findUnique({ where: { email } });
  const isValid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !isValid) {
    checkAndRecordFailure(rateLimitKey, MAX_LOGIN_ATTEMPTS, LOGIN_WINDOW_MS);
    return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
  }

  // A successful login clears the slate — a user who mistyped their password a
  // couple of times before getting it right shouldn't be one mistake away from a
  // lockout on their next legitimate attempt.
  resetKey(rateLimitKey);

  const accessToken = signAccessToken({ userId: user.id });
  const refreshToken = signRefreshToken({ userId: user.id });

  // httpOnly cookies are the real auth source for the browser; tokens are still
  // returned in the body too so curl/Postman (no cookie jar) can keep working.
  const response = NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        displayName: user.displayName,
        language: user.language,
        currency: user.currency,
        theme: user.theme,
        createdAt: user.createdAt,
      },
      accessToken,
      refreshToken,
    },
    { status: 200 },
  );
  setAuthCookies(response, accessToken, refreshToken);
  return response;
}
