import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export async function GET(request: Request) {
  const userId = getCurrentUser(request);
  if (!userId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: userId },
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

  if (!user) {
    return NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });
  }

  return NextResponse.json({ user });
}
