import { NextResponse } from "next/server";
import { Prisma } from "@/app/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";
import { requireCsrfHeader } from "@/lib/security/csrf";
import { importSeriesSchema } from "@/lib/validation/series";
import { fetchMediaById } from "@/lib/anilist";

export async function POST(request: Request) {
  const userId = getCurrentUser(request);
  if (!userId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }
  if (!requireCsrfHeader(request)) {
    return NextResponse.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
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

  // create() + catch P2002 (unique constraint on anilistId) instead of upsert(), because
  // upsert() doesn't report whether it took the create or update branch — and that's
  // exactly what decides whether volumes get auto-created below.
  let series;
  let isNewSeries: boolean;
  try {
    series = await prisma.series.create({
      data: {
        anilistId,
        title,
        coverUrl: media.coverImage.large ?? undefined,
        type,
        genres: media.genres.slice(0, 10),
        source: "SYSTEM",
        createdById: null,
      },
    });
    isNewSeries = true;
  } catch (error) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") {
      series = await prisma.series.findUniqueOrThrow({ where: { anilistId } });
      isNewSeries = false;
    } else {
      throw error;
    }
  }

  // Only pre-populate volumes for a brand-new series, and only when AniList reports a
  // fixed volume count — an ongoing series (volumes: null) is left for the user to add
  // to manually via the "+" button.
  if (isNewSeries && Number.isInteger(media.volumes) && (media.volumes as number) > 0) {
    const totalVolumes = media.volumes as number;
    await prisma.volume.createMany({
      data: Array.from({ length: totalVolumes }, (_, index) => ({
        seriesId: series.id,
        volumeNumber: index + 1,
        releaseDate: null,
      })),
    });
  }

  return NextResponse.json(series);
}
