import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { updateSeriesSchema } from "@/lib/validation/series";

export async function GET(_request: Request, context: RouteContext<"/api/series/[id]">) {
  const { id } = await context.params;

  const series = await prisma.series.findUnique({
    where: { id },
    include: { volumes: { orderBy: { volumeNumber: "asc" } } },
  });

  if (!series) {
    return NextResponse.json({ error: "Không tìm thấy series" }, { status: 404 });
  }

  return NextResponse.json(series);
}

export async function PATCH(request: Request, context: RouteContext<"/api/series/[id]">) {
  const userId = getCurrentUser(request);
  if (!userId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const { id } = await context.params;

  const series = await prisma.series.findUnique({ where: { id } });
  if (!series) {
    return NextResponse.json({ error: "Không tìm thấy series" }, { status: 404 });
  }
  if (series.createdById !== userId) {
    return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 403 });
  }

  const body = await request.json().catch(() => null);
  const parsed = updateSeriesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const updated = await prisma.series.update({
    where: { id },
    data: parsed.data,
  });

  return NextResponse.json(updated);
}

export async function DELETE(request: Request, context: RouteContext<"/api/series/[id]">) {
  const userId = getCurrentUser(request);
  if (!userId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const { id } = await context.params;

  const series = await prisma.series.findUnique({ where: { id } });
  if (!series) {
    return NextResponse.json({ error: "Không tìm thấy series" }, { status: 404 });
  }
  if (series.createdById !== userId) {
    return NextResponse.json({ error: "Bạn không có quyền thực hiện thao tác này" }, { status: 403 });
  }

  await prisma.series.delete({ where: { id } });

  return new NextResponse(null, { status: 204 });
}
