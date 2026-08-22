"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import type { AniListMedia } from "@/lib/anilist";
import { useImportSeries } from "@/lib/hooks/useImportSeries";

const DEBOUNCE_MS = 400;
const MAX_QUERY_LENGTH = 100;

interface SearchApiResponse {
  items: AniListMedia[];
}

async function parseErrorMessage(response: Response): Promise<string> {
  const data = await response.json().catch(() => null);
  return (data?.error as string | undefined) ?? "Có lỗi xảy ra, vui lòng thử lại";
}

export function SearchBar() {
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<AniListMedia[]>([]);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [resolvedQuery, setResolvedQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const { isImporting, error: importError, importSeries } = useImportSeries();

  const isSearching = debouncedQuery.length > 0 && resolvedQuery !== debouncedQuery;

  // Open/close the dropdown reactively as the debounced query crosses the empty <->
  // non-empty boundary. Computed during render (React's "adjusting state when a value
  // changes" pattern) instead of in a useEffect, so it never fires a synchronous
  // setState from an effect body.
  const queryIsEmpty = debouncedQuery.length === 0;
  const [wasQueryEmpty, setWasQueryEmpty] = useState(true);
  if (queryIsEmpty !== wasQueryEmpty) {
    setWasQueryEmpty(queryIsEmpty);
    setIsOpen(!queryIsEmpty);
  }

  // Debounce: only refresh debouncedQuery 400ms after the user stops typing.
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedQuery(query.trim()), DEBOUNCE_MS);
    return () => clearTimeout(timeout);
  }, [query]);

  // Fetch results whenever the debounced query changes. setState only ever happens
  // inside the async .then()/.catch() callbacks below, never synchronously in the
  // effect body.
  useEffect(() => {
    if (debouncedQuery.length === 0) return;
    let cancelled = false;

    fetch(`/api/search?q=${encodeURIComponent(debouncedQuery)}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await parseErrorMessage(response));
        return (await response.json()) as SearchApiResponse;
      })
      .then((data) => {
        if (cancelled) return;
        setResults(data.items);
        setSearchError(null);
        setResolvedQuery(debouncedQuery);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setSearchError(err instanceof Error ? err.message : "Không thể tìm kiếm");
        setResults([]);
        setResolvedQuery(debouncedQuery);
      });

    return () => {
      cancelled = true;
    };
  }, [debouncedQuery]);

  // Close on click-outside or Escape.
  useEffect(() => {
    if (!isOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") setIsOpen(false);
    }

    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKeyDown);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen]);

  const handleSelect = (media: AniListMedia) => {
    setIsOpen(false);
    void importSeries(media.id);
  };

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <svg
          className="pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2 text-neutral-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
          aria-hidden="true"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M21 21l-4.35-4.35M17 11a6 6 0 11-12 0 6 6 0 0112 0z"
          />
        </svg>
        <input
          type="text"
          value={query}
          onChange={(event) => setQuery(event.target.value.slice(0, MAX_QUERY_LENGTH))}
          onFocus={() => {
            if (debouncedQuery.length > 0) setIsOpen(true);
          }}
          // Escape closes the dropdown but doesn't blur the input, so a plain re-click
          // on an already-focused input fires no new "focus" event — onClick covers
          // that case too (redundant with onFocus on a fresh click, which is harmless).
          onClick={() => {
            if (debouncedQuery.length > 0) setIsOpen(true);
          }}
          placeholder="Tìm manga, light novel trên AniList..."
          className="w-full rounded-xl border border-neutral-300 bg-transparent py-2 pr-3 pl-10 text-sm shadow-md transition-all duration-200 focus:border-neutral-500 focus:shadow-lg focus:outline-none dark:border-neutral-700"
        />
      </div>

      {isOpen && (
        <div className="absolute z-30 mt-2 w-full overflow-hidden rounded-xl border border-neutral-300 bg-background shadow-xl dark:border-neutral-700">
          {isSearching && <p className="px-4 py-3 text-sm text-neutral-500">Đang tìm...</p>}
          {!isSearching && searchError && <p className="px-4 py-3 text-sm text-red-600">{searchError}</p>}
          {!isSearching && !searchError && results.length === 0 && (
            <p className="px-4 py-3 text-sm text-neutral-500">Không tìm thấy kết quả</p>
          )}
          {!isSearching &&
            !searchError &&
            results.map((media) => {
              const title = media.title.romaji ?? media.title.english ?? "Không có tên";
              return (
                <button
                  key={media.id}
                  type="button"
                  disabled={isImporting}
                  onClick={() => handleSelect(media)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-100 disabled:opacity-50 dark:hover:bg-neutral-900"
                >
                  <div className="relative h-12 w-9 shrink-0 overflow-hidden rounded bg-neutral-100 dark:bg-neutral-900">
                    {media.coverImage.large && (
                      <Image src={media.coverImage.large} alt={title} fill sizes="36px" className="object-cover" />
                    )}
                  </div>
                  <span className="line-clamp-2 flex-1">{title}</span>
                </button>
              );
            })}
        </div>
      )}

      {importError && <p className="mt-2 text-sm text-red-600">{importError}</p>}
    </div>
  );
}
