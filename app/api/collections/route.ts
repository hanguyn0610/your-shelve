import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

export async function GET(request: Request) {
  const userId = getCurrentUser(request);
  if (!userId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const seriesId = searchParams.get("seriesId") ?? undefined;

  // userId always comes from the verified token above — never from query/body —
  // so this can never return another user's collection rows.
  const items = await prisma.userCollection.findMany({
    where: {
      userId,
      ...(seriesId ? { volume: { seriesId } } : {}),
    },
    include: {
      volume: {
        include: { series: true },
      },
    },
  });

  return NextResponse.json({ items });
}
