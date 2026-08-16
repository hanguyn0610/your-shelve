import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { loginSchema } from "@/lib/validation/auth";
import { verifyPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";

// Hash of an unused fixed string. Compared against when no user is found so that a
// missing email doesn't respond faster than a wrong password (timing side-channel).
const DUMMY_HASH = "$2b$10$BbyFHFnqnBOAit2FHd0CBujRvbcJwphKnkNpAH24o3O.kU.qhVyVG";

const INVALID_CREDENTIALS_MESSAGE = "Email hoặc mật khẩu không đúng";

export async function POST(request: Request) {
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

  return NextResponse.json(
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
}
