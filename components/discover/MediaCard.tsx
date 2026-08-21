"use client";

import { useState, type MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { AniListMedia } from "@/lib/anilist";
import { useAuth } from "@/lib/auth/AuthContext";

const FORMAT_LABEL: Record<string, string> = {
  MANGA: "Manga",
  NOVEL: "Light Novel",
};

async function parseErrorMessage(response: Response): Promise<string> {
  const data = await response.json().catch(() => null);
  return (data?.error as string | undefined) ?? "Có lỗi xảy ra, vui lòng thử lại";
}

export function MediaCard({ media }: { media: AniListMedia }) {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const title = media.title.romaji ?? media.title.english ?? "Không có tên";

  const handleClick = async (event: MouseEvent) => {
    event.preventDefault();
    if (isImporting) return;

    // The destination isn't known until the import call resolves (new vs. already-
    // imported Series get the same DB id either way), so this can't be a plain <Link
    // href>; it's wrapped in one anyway per the card's usual clickable-card styling.
    if (!isAuthLoading && !user) {
      router.push(`/login?redirectTo=${encodeURIComponent("/")}`);
      return;
    }

    setIsImporting(true);
    setError(null);
    try {
      // The route looks up title/coverUrl/type/genres from AniList itself by this id
      // — it doesn't trust client-submitted values for SYSTEM data shared by everyone.
      const response = await fetch("/api/series/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ anilistId: media.id }),
      });
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      const series = (await response.json()) as { id: string };
      router.push(`/series/${series.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại");
      setIsImporting(false);
    }
  };

  return (
    <Link href="#" onClick={handleClick} className="block">
      <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
        <div className="relative aspect-2/3 w-full bg-neutral-100 dark:bg-neutral-900">
          {media.coverImage.large && (
            <Image
              src={media.coverImage.large}
              alt={title}
              fill
              sizes="(min-width: 1024px) 200px, (min-width: 640px) 25vw, 50vw"
              className="object-cover"
            />
          )}
          <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
            {FORMAT_LABEL[media.format] ?? media.format}
          </span>
          {isImporting && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium text-white">
              Đang thêm...
            </span>
          )}
        </div>
        <div className="p-2">
          <p className="line-clamp-2 text-sm font-medium">{title}</p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      </div>
    </Link>
  );
}
