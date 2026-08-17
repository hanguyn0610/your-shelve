"use client";

import { useCallback, useEffect, useState } from "react";
import type { AniListMedia, MediaFormatFilter } from "@/lib/anilist";

const PER_PAGE = 20;

interface TrendingApiResponse {
  items: AniListMedia[];
  page: number;
  perPage: number;
  format: MediaFormatFilter | null;
}

interface UseTrendingResult {
  items: AniListMedia[];
  isLoading: boolean;
  error: string | null;
  format: MediaFormatFilter;
  hasMore: boolean;
  setFormat: (format: MediaFormatFilter) => void;
  loadMore: () => void;
}

function requestKeyOf(format: MediaFormatFilter, page: number): string {
  return `${format}:${page}`;
}

export function useTrending(initialFormat: MediaFormatFilter = "MANGA"): UseTrendingResult {
  const [format, setFormatState] = useState<MediaFormatFilter>(initialFormat);
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<AniListMedia[]>([]);
  const [error, setError] = useState<string | null>(null);
  // AniList doesn't hand back a total-pages count here, so "more available" is inferred
  // from getting a full page back — a short page means we've hit the end.
  const [hasMore, setHasMore] = useState(true);
  // The page/format pair whose result is currently reflected in items/error. While it
  // doesn't match the current page/format, a fetch for that pair is still in flight —
  // this derives isLoading during render instead of setting it imperatively in the
  // effect (avoids a synchronous setState-in-effect, which causes cascading renders).
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const isLoading = resolvedKey !== requestKeyOf(format, page);

  useEffect(() => {
    let cancelled = false;
    const key = requestKeyOf(format, page);

    fetch(`/api/trending?page=${page}&perPage=${PER_PAGE}&format=${format}`)
      .then(async (response) => {
        if (!response.ok) {
          const data = await response.json().catch(() => null);
          throw new Error(data?.error ?? "Không thể tải dữ liệu trending");
        }
        return (await response.json()) as TrendingApiResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setError(null);
        setItems((prev) => (page === 1 ? data.items : [...prev, ...data.items]));
        setHasMore(data.items.length === PER_PAGE);
        setResolvedKey(key);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Không thể tải dữ liệu trending");
        setResolvedKey(key);
      });

    return () => {
      cancelled = true;
    };
  }, [page, format]);

  const setFormat = useCallback((next: MediaFormatFilter) => {
    setFormatState(next);
    setPage(1);
    setItems([]);
  }, []);

  const loadMore = useCallback(() => {
    setPage((current) => current + 1);
  }, []);

  return { items, isLoading, error: isLoading ? null : error, format, hasMore, setFormat, loadMore };
}
