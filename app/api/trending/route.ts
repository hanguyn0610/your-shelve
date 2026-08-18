import { NextResponse } from "next/server";
import { z } from "zod";
import { fetchTrendingMedia } from "@/lib/anilist";
import { getOrSetCache } from "@/lib/cache";

const CACHE_TTL_MS = 15 * 60 * 1000;

const trendingQuerySchema = z.object({
  page: z.coerce.number("page phải là số").int("page phải là số nguyên").min(1, "page phải >= 1").default(1),
  perPage: z.coerce
    .number("perPage phải là số")
    .int("perPage phải là số nguyên")
    .min(1, "perPage tối thiểu 1")
    .max(50, "perPage tối đa 50")
    .default(20),
  format: z.enum(["MANGA", "NOVEL"]).optional(),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = trendingQuerySchema.safeParse({
    page: searchParams.get("page") ?? undefined,
    perPage: searchParams.get("perPage") ?? undefined,
    format: searchParams.get("format") ?? undefined,
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Query không hợp lệ", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const { page, perPage, format } = parsed.data;
  // countryOfOrigin (JP) is fixed inside fetchTrendingMedia, not a request-varying
  // input here, so it deliberately isn't part of the cache key.
  const cacheKey = `trending:${page}:${perPage}:${format ?? "ALL"}`;

  try {
    const items = await getOrSetCache(cacheKey, CACHE_TTL_MS, () => fetchTrendingMedia(page, perPage, format));

    return NextResponse.json({ page, perPage, format: format ?? null, items });
  } catch {
    return NextResponse.json(
      { error: "Không thể lấy dữ liệu trending từ AniList, vui lòng thử lại sau" },
      { status: 502 },
    );
  }
}
