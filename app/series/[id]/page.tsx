"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { useParams } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCollections } from "@/lib/hooks/useCollections";

interface SeriesVolume {
  id: string;
  seriesId: string;
  volumeNumber: number;
  releaseDate: string | null;
}

interface SeriesDetail {
  id: string;
  title: string;
  coverUrl: string | null;
  type: "MANGA" | "LIGHT_NOVEL";
  source: "SYSTEM" | "USER_CREATED";
  genres: string[];
  createdById: string | null;
  volumes: SeriesVolume[];
}

const TYPE_LABEL: Record<string, string> = {
  MANGA: "Manga",
  LIGHT_NOVEL: "Light Novel",
};

async function parseErrorMessage(response: Response): Promise<string> {
  const data = await response.json().catch(() => null);
  return (data?.error as string | undefined) ?? "Có lỗi xảy ra, vui lòng thử lại";
}

export default function SeriesDetailPage() {
  const { id: seriesId } = useParams<{ id: string }>();
  const { user } = useAuth();
  const { items: collectionItems, updateCollection } = useCollections(seriesId);

  const [series, setSeries] = useState<SeriesDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  // The seriesId whose result is currently reflected in series/error. While it
  // doesn't match the current seriesId, a fetch for it is still in flight — this
  // derives isLoading during render instead of setting it imperatively in the effect
  // (avoids a synchronous setState-in-effect, same pattern as useTrending.ts).
  const [resolvedSeriesId, setResolvedSeriesId] = useState<string | null>(null);
  const isLoading = resolvedSeriesId !== seriesId;

  useEffect(() => {
    let cancelled = false;

    fetch(`/api/series/${seriesId}`)
      .then(async (response) => {
        if (!response.ok) throw new Error(await parseErrorMessage(response));
        return (await response.json()) as SeriesDetail;
      })
      .then((data) => {
        if (cancelled) return;
        setSeries(data);
        setError(null);
        setResolvedSeriesId(seriesId);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        setError(err instanceof Error ? err.message : "Không thể tải series");
        setResolvedSeriesId(seriesId);
      });

    return () => {
      cancelled = true;
    };
  }, [seriesId]);

  const collectionByVolumeId = useMemo(() => {
    const map = new Map<string, (typeof collectionItems)[number]>();
    for (const item of collectionItems) {
      map.set(item.volumeId, item);
    }
    return map;
  }, [collectionItems]);

  const canAddVolume = !!user && !!series && (series.source === "SYSTEM" || series.createdById === user.id);

  const [volumeNumberInput, setVolumeNumberInput] = useState("");
  const [addVolumeError, setAddVolumeError] = useState<string | null>(null);
  const [isAddingVolume, setIsAddingVolume] = useState(false);

  const handleToggleOwned = async (volumeId: string) => {
    const existing = collectionByVolumeId.get(volumeId);
    try {
      await updateCollection(volumeId, {
        owned: !(existing?.owned ?? false),
        edition: existing?.edition ?? "REGULAR",
        price: existing?.price ? Number(existing.price) : undefined,
        purchaseDate: existing?.purchaseDate ? existing.purchaseDate.slice(0, 10) : undefined,
      });
    } catch {
      // No dedicated error UI for this quick toggle — a failed request just leaves
      // the checkbox showing its last confirmed state on the next render.
    }
  };

  const handleAddVolume = async (event: FormEvent) => {
    event.preventDefault();
    const volumeNumber = Number(volumeNumberInput);
    if (!Number.isInteger(volumeNumber) || volumeNumber <= 0) {
      setAddVolumeError("Số tập phải là số nguyên dương");
      return;
    }

    setIsAddingVolume(true);
    setAddVolumeError(null);
    try {
      const response = await fetch(`/api/series/${seriesId}/volumes`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ volumeNumber }),
      });
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      const newVolume = (await response.json()) as SeriesVolume;
      setSeries((prev) =>
        prev
          ? { ...prev, volumes: [...prev.volumes, newVolume].sort((a, b) => a.volumeNumber - b.volumeNumber) }
          : prev,
      );
      setVolumeNumberInput("");
    } catch (err) {
      setAddVolumeError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại");
    } finally {
      setIsAddingVolume(false);
    }
  };

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      {isLoading && <p className="text-sm text-neutral-500">Đang tải...</p>}
      {error && <p className="text-sm text-red-600">{error}</p>}

      {!isLoading && series && (
        <>
          <div className="flex gap-4">
            <div className="relative h-48 w-32 shrink-0 overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-900">
              {series.coverUrl && (
                <Image src={series.coverUrl} alt={series.title} fill sizes="128px" className="object-cover" />
              )}
            </div>
            <div>
              <h1 className="text-2xl font-semibold">{series.title}</h1>
              <p className="mt-1 text-sm text-neutral-500">{TYPE_LABEL[series.type] ?? series.type}</p>
              {series.genres.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {series.genres.map((genre) => (
                    <span
                      key={genre}
                      className="rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium dark:bg-neutral-900"
                    >
                      {genre}
                    </span>
                  ))}
                </div>
              )}
            </div>
          </div>

          <section className="mt-6">
            <h2 className="text-base font-semibold">Các tập</h2>

            {series.volumes.length === 0 && <p className="mt-2 text-sm text-neutral-500">Chưa có tập nào.</p>}

            <div className="mt-3 flex flex-wrap gap-2">
              {series.volumes.map((volume) => {
                const owned = collectionByVolumeId.get(volume.id)?.owned ?? false;
                return (
                  <label
                    key={volume.id}
                    className={
                      owned
                        ? "flex h-14 w-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                        : "flex h-14 w-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
                    }
                  >
                    {user && (
                      <input
                        type="checkbox"
                        checked={owned}
                        onChange={() => handleToggleOwned(volume.id)}
                        className="h-3.5 w-3.5"
                        aria-label={`Đã sở hữu tập ${volume.volumeNumber}`}
                      />
                    )}
                    <span className="text-xs font-semibold">{volume.volumeNumber}</span>
                  </label>
                );
              })}
            </div>

            {canAddVolume && (
              <form onSubmit={handleAddVolume} className="mt-4 flex items-end gap-2">
                <div className="space-y-1">
                  <label htmlFor="volumeNumber" className="text-sm font-medium">
                    Thêm tập
                  </label>
                  <input
                    id="volumeNumber"
                    type="number"
                    min="1"
                    step="1"
                    value={volumeNumberInput}
                    onChange={(event) => setVolumeNumberInput(event.target.value)}
                    // Disabled while a submit is in flight — otherwise typing the next
                    // volume number before the previous request resolves gets wiped out
                    // when that request's success handler clears the field back to "".
                    disabled={isAddingVolume}
                    className="block w-24 rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 disabled:opacity-50 dark:border-neutral-700"
                  />
                </div>
                <button
                  type="submit"
                  disabled={isAddingVolume}
                  className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
                >
                  {isAddingVolume ? "Đang thêm..." : "Thêm tập"}
                </button>
              </form>
            )}
            {addVolumeError && <p className="mt-2 text-sm text-red-600">{addVolumeError}</p>}
          </section>
        </>
      )}
    </main>
  );
}
