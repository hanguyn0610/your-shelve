"use client";

import Link from "next/link";
import { useMemo } from "react";
import { useCollections, type CollectionItem, type CollectionSeries } from "@/lib/hooks/useCollections";
import { SeriesGroup } from "@/components/shelf/SeriesGroup";

interface SeriesGroupData {
  series: CollectionSeries;
  items: CollectionItem[];
}

export default function ShelfPage() {
  const { items, isLoading, error, updateCollection, removeCollection } = useCollections();

  const groups = useMemo(() => {
    const map = new Map<string, SeriesGroupData>();
    for (const item of items) {
      const series = item.volume.series;
      const existing = map.get(series.id);
      if (existing) {
        existing.items.push(item);
      } else {
        map.set(series.id, { series, items: [item] });
      }
    }
    return [...map.values()].sort((a, b) => a.series.title.localeCompare(b.series.title));
  }, [items]);

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <h1 className="text-2xl font-semibold">Tủ sách của bạn</h1>

      {isLoading && <p className="mt-6 text-sm text-neutral-500">Đang tải...</p>}

      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {!isLoading && !error && groups.length === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">Tủ sách của bạn đang trống.</p>
          <Link href="/" className="mt-2 inline-block text-sm font-medium underline">
            Tìm sách để thêm vào tủ sách
          </Link>
        </div>
      )}

      {!isLoading && groups.length > 0 && (
        <div className="mt-6 space-y-4">
          {groups.map((group) => (
            <SeriesGroup
              key={group.series.id}
              series={group.series}
              items={group.items}
              onUpdate={updateCollection}
              onRemove={removeCollection}
            />
          ))}
        </div>
      )}
    </main>
  );
}
