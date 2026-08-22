import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireCsrfHeader } from "@/lib/security/csrf";
import { registerSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";
import { setAuthCookies } from "@/lib/auth/setAuthCookies";

export async function POST(request: Request) {
  // Public route (no session yet to check), so the CSRF check is the very first thing.
  if (!requireCsrfHeader(request)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = registerSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const email = parsed.data.email.trim().toLowerCase();
  const { password, displayName } = parsed.data;

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    return NextResponse.json({ error: "Email đã được sử dụng" }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  const user = await prisma.user.create({
    data: { email, passwordHash, displayName },
    select: {
      id: true,
      email: true,
      displayName: true,
      language: true,
      currency: true,
      theme: true,
      createdAt: true,
    },
  });

  const accessToken = signAccessToken({ userId: user.id });
  const refreshToken = signRefreshToken({ userId: user.id });

  // httpOnly cookies are the real auth source for the browser; tokens are still
  // returned in the body too so curl/Postman (no cookie jar) can keep working.
  const response = NextResponse.json({ user, accessToken, refreshToken }, { status: 201 });
  setAuthCookies(response, accessToken, refreshToken);
  return response;
}
