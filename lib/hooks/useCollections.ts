"use client";

import { useCallback, useEffect, useState } from "react";

export type CollectionEdition = "REGULAR" | "SPECIAL" | "COLLECTOR";

export interface CollectionSeries {
  id: string;
  title: string;
  coverUrl: string | null;
  type: "MANGA" | "LIGHT_NOVEL";
  source: "SYSTEM" | "USER_CREATED";
  genres: string[];
  createdById: string | null;
}

export interface CollectionVolume {
  id: string;
  seriesId: string;
  volumeNumber: number;
  releaseDate: string | null;
  series: CollectionSeries;
}

export interface CollectionItem {
  id: string;
  userId: string;
  volumeId: string;
  owned: boolean;
  edition: CollectionEdition;
  // Prisma serializes Decimal as a string over JSON, not a number.
  price: string | null;
  purchaseDate: string | null;
  volume: CollectionVolume;
}

export interface UpdateCollectionInput {
  owned: boolean;
  edition: CollectionEdition;
  price?: number;
  purchaseDate?: string;
}

interface UseCollectionsResult {
  items: CollectionItem[];
  isLoading: boolean;
  error: string | null;
  updateCollection: (volumeId: string, data: UpdateCollectionInput) => Promise<void>;
  removeCollection: (volumeId: string) => Promise<void>;
  refetch: () => void;
}

async function parseErrorMessage(response: Response): Promise<string> {
  const data = await response.json().catch(() => null);
  return (data?.error as string | undefined) ?? "Có lỗi xảy ra, vui lòng thử lại";
}

export function useCollections(seriesId?: string): UseCollectionsResult {
  const [items, setItems] = useState<CollectionItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  // The (seriesId, reloadToken) pair whose result is currently reflected in items/error.
  // While it doesn't match the current request key, a fetch for that key is still in
  // flight — this derives isLoading during render instead of setting it imperatively
  // in the effect (avoids a synchronous setState-in-effect, which causes cascading
  // renders — see the identical pattern in useTrending.ts).
  const requestKey = `${seriesId ?? ""}:${reloadToken}`;
  const [resolvedKey, setResolvedKey] = useState<string | null>(null);
  const isLoading = resolvedKey !== requestKey;

  useEffect(() => {
    let cancelled = false;
    const key = `${seriesId ?? ""}:${reloadToken}`;

    const query = seriesId ? `?seriesId=${encodeURIComponent(seriesId)}` : "";
    fetch(`/api/collections${query}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await parseErrorMessage(response));
        return (await response.json()) as { items: CollectionItem[] };
      })
      .then((data) => {
        if (cancelled) return;
        setItems(data.items);
        setError(null);
        setResolvedKey(key);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Không thể tải tủ sách");
        setResolvedKey(key);
      });

    return () => {
      cancelled = true;
    };
  }, [seriesId, reloadToken]);

  const updateCollection = useCallback(async (volumeId: string, data: UpdateCollectionInput) => {
    const response = await fetch(`/api/collections/${volumeId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      throw new Error(await parseErrorMessage(response));
    }
    const updated = (await response.json()) as Omit<CollectionItem, "volume">;

    setItems((prev) => {
      const index = prev.findIndex((item) => item.volumeId === volumeId);
      if (index === -1) {
        // Wasn't part of the currently loaded list (e.g. never fetched yet) — the PUT
        // response doesn't carry volume/series info to merge in locally, so this one
        // case falls back to a refetch instead of leaving stale/incomplete data.
        setReloadToken((token) => token + 1);
        return prev;
      }
      const next = [...prev];
      const existing = next[index];
      if (!existing) return prev;
      next[index] = { ...existing, ...updated };
      return next;
    });
  }, []);

  const removeCollection = useCallback(async (volumeId: string) => {
    const response = await fetch(`/api/collections/${volumeId}`, { method: "DELETE" });
    if (!response.ok && response.status !== 404) {
      throw new Error(await parseErrorMessage(response));
    }
    setItems((prev) => prev.filter((item) => item.volumeId !== volumeId));
  }, []);

  const refetch = useCallback(() => setReloadToken((token) => token + 1), []);

  return { items, isLoading, error, updateCollection, removeCollection, refetch };
}
