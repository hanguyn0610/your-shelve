import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { createSeriesSchema } from "@/lib/validation/series";

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const pageParam = Number(searchParams.get("page"));
  const limitParam = Number(searchParams.get("limit"));

  const page = Number.isInteger(pageParam) && pageParam > 0 ? pageParam : 1;
  const limit = Number.isInteger(limitParam) && limitParam > 0 ? Math.min(limitParam, MAX_LIMIT) : DEFAULT_LIMIT;

  const [items, total] = await Promise.all([
    prisma.series.findMany({
      orderBy: { title: "asc" },
      skip: (page - 1) * limit,
      take: limit,
    }),
    prisma.series.count(),
  ]);

  return NextResponse.json({ items, page, limit, total });
}

export async function POST(request: Request) {
  const userId = getCurrentUser(request);
  if (!userId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = createSeriesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const series = await prisma.series.create({
    data: {
      title: parsed.data.title,
      coverUrl: parsed.data.coverUrl,
      type: parsed.data.type,
      genres: parsed.data.genres,
      source: "USER_CREATED",
      createdById: userId,
    },
  });

  return NextResponse.json(series, { status: 201 });
}
