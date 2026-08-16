import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { registerSchema } from "@/lib/validation/auth";
import { hashPassword } from "@/lib/auth/password";
import { signAccessToken, signRefreshToken } from "@/lib/auth/jwt";

export async function POST(request: Request) {
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

  return NextResponse.json({ user, accessToken, refreshToken }, { status: 201 });
}
