import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCsrfHeader } from "@/lib/security/csrf";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/setAuthCookies";

// Hash of an unused fixed string. Compared against when no user is found so that a
// missing email doesn't respond faster than a wrong password (timing side-channel).
const DUMMY_HASH = "$2b$12$wI1VLiYydpVZpHhBiiiwdOavBLsJEEHa0idgam7Bw20wg0ay1WpHu"; // Hash of an unused fixed string, generated with the SAME cost factor as
// BCRYPT_SALT_ROUNDS (12) so real vs. non-existent users take equal time to verify. 

const INVALID_CREDENTIALS_MESSAGE = "Email hoặc mật khẩu không đúng";

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

  const user = await prisma.user.findUnique({ where: { email } });
  const isValid = await verifyPassword(password, user?.passwordHash ?? DUMMY_HASH);

  if (!user || !isValid) {
    return NextResponse.json({ error: INVALID_CREDENTIALS_MESSAGE }, { status: 401 });
  }

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
