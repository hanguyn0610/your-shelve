import { NextResponse } from "next/server";
import { z } from "zod";
import { searchMedia } from "@/lib/anilist";

// Capped, not client-configurable — this is a search-as-you-type dropdown, not a
// paginated results page.
const SEARCH_RESULT_LIMIT = 8;

const searchQuerySchema = z.object({
  q: z.string().trim().min(1, "q là bắt buộc").max(100, "q tối đa 100 ký tự"),
});

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);

  const parsed = searchQuerySchema.safeParse({ q: searchParams.get("q") ?? undefined });
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Query không hợp lệ", details: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    // Deliberately uncached: every distinct query is its own cache key, so caching here
    // wouldn't meaningfully cut AniList calls but would grow memory unboundedly.
    const items = await searchMedia(parsed.data.q, SEARCH_RESULT_LIMIT);
    return NextResponse.json({ items });
  } catch {
    return NextResponse.json(
      { error: "Không thể tìm kiếm trên AniList, vui lòng thử lại sau" },
      { status: 502 },
    );
  }
}
