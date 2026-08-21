import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { importSeriesSchema } from "@/lib/validation/series";
import { fetchMediaById } from "@/lib/anilist";

export async function POST(request: Request) {
  const userId = getCurrentUser(request);
  if (!userId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const body = await request.json().catch(() => null);
  const parsed = importSeriesSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Dữ liệu không hợp lệ", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { anilistId } = parsed.data;

  // title/coverUrl/type/genres are looked up here, from AniList itself — never taken
  // from the request body — because this creates SYSTEM data shared by every user;
  // trusting client-submitted values would let anyone plant fabricated content that
  // everyone else then sees.
  let media;
  try {
    media = await fetchMediaById(anilistId);
  } catch {
    return NextResponse.json(
      { error: "Không thể lấy dữ liệu từ AniList, vui lòng thử lại sau" },
      { status: 502 },
    );
  }

  if (!media) {
    return NextResponse.json({ error: "Không tìm thấy manga/LN với ID này" }, { status: 404 });
  }

  const title = media.title.romaji ?? media.title.english ?? "Không có tên";
  const type = media.format === "NOVEL" ? "LIGHT_NOVEL" : "MANGA";

  const series = await prisma.series.upsert({
    where: { anilistId },
    create: {
      anilistId,
      title,
      coverUrl: media.coverImage.large ?? undefined,
      type,
      genres: media.genres.slice(0, 10),
      source: "SYSTEM",
      createdById: null,
    },
    update: {},
  });

  return NextResponse.json(series);
}
