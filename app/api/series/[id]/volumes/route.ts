import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createVolumeSchema } from "@/lib/validation/series";

export async function POST(request: Request, context: RouteContext<"/api/series/[id]/volumes">) {
  const userId = getCurrentUser(request);
  if (!userId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const { id } = await context.params;

  const series = await prisma.series.findUnique({ where: { id } });
  if (!series) {
    return NextResponse.json({ error: "Không tìm thấy series" }, { status: 404 });
  }
  // SYSTEM series have no single owner — their volume data (e.g. imported from
  // AniList trending) is shared across every user, so any authenticated user may add
  // a volume to it. USER_CREATED series still require createdById to match — this
  // check only gates adding a volume, not editing/deleting the series itself.
  const canAddVolume = series.source === "SYSTEM" || series.createdById === userId;
  if (!canAddVolume) {
    return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createVolumeSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const volume = await prisma.volume.create({
    data: {
      seriesId: id,
      volumeNumber: parsed.data.volumeNumber,
      // Prisma's date-only DB columns still require a full ISO-8601 DateTime string,
      // "YYYY-MM-DD" alone is rejected — normalize via Date before passing it through.
      releaseDate: parsed.data.releaseDate ? new Date(parsed.data.releaseDate) : undefined,
    },
  });

  return NextResponse.json(volume, { status: 201 });
}
