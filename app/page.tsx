"use client";

import { useTrending } from "@/lib/hooks/useTrending";
import { MediaCard } from "@/components/discover/MediaCard";
import { SearchBar } from "@/components/discover/SearchBar";
import type { MediaFormatFilter } from "@/lib/anilist";

const TABS: { value: MediaFormatFilter; label: string }[] = [
  { value: "MANGA", label: "Manga" },
  { value: "NOVEL", label: "Light Novel" },
];

export default function DiscoverPage() {
  const { items, isLoading, error, format, hasMore, setFormat, loadMore } = useTrending("MANGA");

  return (
    <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6">
      <h1 className="text-2xl font-semibold">Trending</h1>

      <div className="mt-4 max-w-md">
        <SearchBar />
      </div>

      <div className="mt-4 flex gap-2">
        {TABS.map((tab) => (
          <button
            key={tab.value}
            type="button"
            onClick={() => setFormat(tab.value)}
            className={
              tab.value === format
                ? "rounded-full bg-neutral-900 px-4 py-1.5 text-sm font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                : "rounded-full border border-neutral-300 px-4 py-1.5 text-sm font-medium text-neutral-600 hover:border-neutral-400 dark:border-neutral-700 dark:text-neutral-400"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
        {items.map((media) => (
          <MediaCard key={media.id} media={media} />
        ))}
      </div>

      {isLoading && <p className="mt-6 text-center text-sm text-neutral-500">Đang tải...</p>}

      {!isLoading && !error && hasMore && items.length > 0 && (
        <div className="mt-6 flex justify-center">
          <button
            type="button"
            onClick={loadMore}
            className="rounded-md border border-neutral-300 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:border-neutral-700 dark:hover:bg-neutral-900"
          >
            Xem thêm
          </button>
        </div>
      )}
    </main>
  );
}
