"use client";

import { useEffect, useState } from "react";

export interface SpendingByMonth {
  month: string;
  total: number;
}

export interface TopSeriesSpending {
  title: string;
  totalSpent: number;
}

export interface CollectionStats {
  totalSpent: number;
  totalVolumesOwned: number;
  spendingByMonth: SpendingByMonth[];
  topSeriesBySpending: TopSeriesSpending[];
}

interface UseCollectionStatsResult {
  stats: CollectionStats | null;
  isLoading: boolean;
  error: string | null;
}

async function parseErrorMessage(response: Response): Promise<string> {
  const data = await response.json().catch(() => null);
  return (data?.error as string | undefined) ?? "Có lỗi xảy ra, vui lòng thử lại";
}

export function useCollectionStats(): UseCollectionStatsResult {
  const [stats, setStats] = useState<CollectionStats | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Starts false and only ever flips true inside a .then()/.catch() callback below —
  // never set synchronously in the effect body (avoids the set-state-in-effect issue
  // that shows up elsewhere in this codebase's other data-fetching hooks).
  const [hasResolved, setHasResolved] = useState(false);
  const isLoading = !hasResolved;

  useEffect(() => {
    let cancelled = false;

    fetch("/api/collections/stats")
      .then(async (response) => {
        if (!response.ok) throw new Error(await parseErrorMessage(response));
        return (await response.json()) as CollectionStats;
      })
      .then((data) => {
        if (cancelled) return;
        setStats(data);
        setError(null);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Không thể tải thống kê");
      })
      .finally(() => {
        if (!cancelled) setHasResolved(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  return { stats, isLoading, error };
}
