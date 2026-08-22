import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireCsrfHeader } from "@/lib/security/csrf";
import { updateProfileSchema } from "@/lib/validation/account";

export async function PATCH(request: Request) {
  const userId = getCurrentUser(request);
  if (!userId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }
  if (!requireCsrfHeader(request)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateProfileSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  // parsed.data only ever contains the whitelisted fields from updateProfileSchema —
  // passed straight through, never merged with the raw request body.
  const user = await prisma.user.update({
    where: { id: userId },
    data: parsed.data,
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

  return NextResponse.json({ user });
}
