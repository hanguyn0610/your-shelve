"use client";

import { useMemo, useState } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { upsertCollectionSchema } from "@/lib/validation/collection";
import type { CollectionItem, CollectionSeries, UpdateCollectionInput } from "@/lib/hooks/useCollections";

const EDITION_LABEL: Record<string, string> = {
  REGULAR: "Thường",
  SPECIAL: "Đặc biệt",
  COLLECTOR: "Sưu tầm",
};

// Reuses the API's own price/date business rules (positive, 2 decimals, date format)
// instead of re-declaring them — only adds the "empty string from an HTML input means
// not provided" step that raw form fields need but the API schema doesn't.
const emptyToUndefined = (val: unknown) => (typeof val === "string" && val.trim() === "" ? undefined : val);

const editVolumeFormSchema = z.object({
  edition: upsertCollectionSchema.shape.edition,
  price: z.preprocess((val) => {
    const cleaned = emptyToUndefined(val);
    return cleaned === undefined ? undefined : Number(cleaned);
  }, upsertCollectionSchema.shape.price),
  purchaseDate: z.preprocess(emptyToUndefined, upsertCollectionSchema.shape.purchaseDate),
});

type EditVolumeFormInput = z.input<typeof editVolumeFormSchema>;
type EditVolumeFormOutput = z.output<typeof editVolumeFormSchema>;

function formatCurrency(amount: number): string {
  return `${new Intl.NumberFormat("vi-VN").format(amount)} đ`;
}

interface SeriesGroupProps {
  series: CollectionSeries;
  items: CollectionItem[];
  onUpdate: (volumeId: string, data: UpdateCollectionInput) => Promise<void>;
  onRemove: (volumeId: string) => Promise<void>;
}

export function SeriesGroup({ series, items, onUpdate, onRemove }: SeriesGroupProps) {
  const [editingItem, setEditingItem] = useState<CollectionItem | null>(null);

  const sortedItems = useMemo(
    () => [...items].sort((a, b) => a.volume.volumeNumber - b.volume.volumeNumber),
    [items],
  );

  const totalSpent = useMemo(
    () => items.reduce((sum, item) => (item.price ? sum + Number(item.price) : sum), 0),
    [items],
  );

  const handleToggleOwned = async (item: CollectionItem) => {
    await onUpdate(item.volumeId, {
      owned: !item.owned,
      edition: item.edition,
      price: item.price ? Number(item.price) : undefined,
      purchaseDate: item.purchaseDate ? item.purchaseDate.slice(0, 10) : undefined,
    });
  };

  return (
    <div className="flex gap-4 rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
      <div className="relative h-32 w-22 shrink-0 overflow-hidden rounded-md bg-neutral-100 dark:bg-neutral-900 sm:h-40 sm:w-28">
        {series.coverUrl && (
          <Image src={series.coverUrl} alt={series.title} fill sizes="120px" className="object-cover" />
        )}
      </div>

      <div className="min-w-0 flex-1">
        <h2 className="truncate text-lg font-semibold">{series.title}</h2>
        {totalSpent > 0 && <p className="mt-1 text-sm text-neutral-500">Đã chi: {formatCurrency(totalSpent)}</p>}

        <div className="mt-3 flex flex-wrap gap-2">
          {sortedItems.map((item) => (
            <div
              key={item.id}
              onClick={() => setEditingItem(item)}
              className={
                item.owned
                  ? "flex h-14 w-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-md bg-neutral-900 text-white dark:bg-neutral-100 dark:text-neutral-900"
                  : "flex h-14 w-14 cursor-pointer flex-col items-center justify-center gap-1 rounded-md border border-neutral-300 text-neutral-600 dark:border-neutral-700 dark:text-neutral-400"
              }
            >
              <input
                type="checkbox"
                checked={item.owned}
                onClick={(event) => event.stopPropagation()}
                onChange={() => handleToggleOwned(item)}
                className="h-3.5 w-3.5"
                aria-label={`Đã sở hữu tập ${item.volume.volumeNumber}`}
              />
              <span className="text-xs font-semibold">{item.volume.volumeNumber}</span>
            </div>
          ))}
        </div>
      </div>

      {editingItem && (
        <VolumeEditModal
          item={editingItem}
          onClose={() => setEditingItem(null)}
          onSave={async (data) => {
            await onUpdate(editingItem.volumeId, { ...data, owned: editingItem.owned });
            setEditingItem(null);
          }}
          onRemove={async () => {
            await onRemove(editingItem.volumeId);
            setEditingItem(null);
          }}
        />
      )}
    </div>
  );
}

interface VolumeEditModalProps {
  item: CollectionItem;
  onClose: () => void;
  onSave: (data: EditVolumeFormOutput) => Promise<void>;
  onRemove: () => Promise<void>;
}

function VolumeEditModal({ item, onClose, onSave, onRemove }: VolumeEditModalProps) {
  const [formError, setFormError] = useState<string | null>(null);
  const [isRemoving, setIsRemoving] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<EditVolumeFormInput, unknown, EditVolumeFormOutput>({
    resolver: zodResolver(editVolumeFormSchema),
    defaultValues: {
      edition: item.edition,
      price: item.price ?? "",
      purchaseDate: item.purchaseDate ? item.purchaseDate.slice(0, 10) : "",
    },
  });

  const submit = async (data: EditVolumeFormOutput) => {
    setFormError(null);
    try {
      await onSave(data);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Có lỗi xảy ra, vui lòng thử lại");
    }
  };

  const handleRemove = async () => {
    setFormError(null);
    setIsRemoving(true);
    try {
      await onRemove();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Có lỗi xảy ra, vui lòng thử lại");
      setIsRemoving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4" onClick={onClose}>
      <div
        onClick={(event) => event.stopPropagation()}
        className="w-full max-w-sm rounded-lg border border-neutral-200 bg-background p-5 dark:border-neutral-800"
      >
        <h3 className="text-base font-semibold">
          {item.volume.series.title} — Tập {item.volume.volumeNumber}
        </h3>

        <form onSubmit={handleSubmit(submit)} className="mt-4 space-y-3" noValidate>
          <div className="space-y-1">
            <label htmlFor="edition" className="text-sm font-medium">
              Phiên bản
            </label>
            <select
              id="edition"
              className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              {...register("edition")}
            >
              {Object.entries(EDITION_LABEL).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            {errors.edition && <p className="text-sm text-red-600">{errors.edition.message}</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor="price" className="text-sm font-medium">
              Giá (đ)
            </label>
            <input
              id="price"
              type="number"
              step="0.01"
              min="0"
              className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              {...register("price")}
            />
            {errors.price && <p className="text-sm text-red-600">{errors.price.message}</p>}
          </div>

          <div className="space-y-1">
            <label htmlFor="purchaseDate" className="text-sm font-medium">
              Ngày mua
            </label>
            <input
              id="purchaseDate"
              type="date"
              className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              {...register("purchaseDate")}
            />
            {errors.purchaseDate && <p className="text-sm text-red-600">{errors.purchaseDate.message}</p>}
          </div>

          {formError && <p className="text-sm text-red-600">{formError}</p>}

          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleRemove}
              disabled={isRemoving}
              className="text-sm text-red-600 hover:underline disabled:opacity-50"
            >
              {isRemoving ? "Đang xoá..." : "Xoá khỏi tủ sách"}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-md border border-neutral-300 px-3 py-1.5 text-sm dark:border-neutral-700"
              >
                Huỷ
              </button>
              <button
                type="submit"
                disabled={isSubmitting}
                className="rounded-md bg-neutral-900 px-3 py-1.5 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
              >
                {isSubmitting ? "Đang lưu..." : "Lưu"}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
