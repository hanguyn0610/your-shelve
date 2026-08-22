import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireCsrfHeader } from "@/lib/security/csrf";
import { changePasswordSchema } from "@/lib/validation/account";
import { hashPassword, verifyPassword } from "@/lib/auth/password";

export async function PATCH(request: Request) {
  const userId = getCurrentUser(request);
  if (!userId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }
  if (!requireCsrfHeader(request)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = changePasswordSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    return NextResponse.json({ error: "Không tìm thấy user" }, { status: 404 });
  }

  const isCurrentPasswordValid = await verifyPassword(parsed.data.currentPassword, user.passwordHash);
  if (!isCurrentPasswordValid) {
    return NextResponse.json({ error: "Mật khẩu hiện tại không đúng" }, { status: 401 });
  }

  const passwordHash = await hashPassword(parsed.data.newPassword);

  // TODO(security): revoke other active sessions/refresh tokens when the password
  // changes (e.g. rotate a per-user token version, or track+invalidate refresh
  // tokens). Skipped for this MVP pass — see Security_Cases for the follow-up.
  await prisma.user.update({
    where: { id: userId },
    data: { passwordHash },
  });

  return NextResponse.json({ success: true });
}
