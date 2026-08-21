"use client";

import { useEffect, useMemo, useState, type FormEvent } from "react";
import Image from "next/image";
import { motion } from "framer-motion";
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

const SPARKLE_OFFSETS = [
  { x: -10, y: -9, delay: 0 },
  { x: 10, y: -7, delay: 0.06 },
];
const SPARKLE_LIFETIME_MS = 450;

// Detects the false -> true transition of `owned` during render (React's blessed
// "adjusting state when a prop changes" pattern, not an effect) so the sparkle burst
// only plays on an actual tick, never on remount or unrelated re-renders. The effect
// below only ever calls setState inside the setTimeout callback, not in its own body.
function useJustTicked(owned: boolean): boolean {
  const [prevOwned, setPrevOwned] = useState(owned);
  const [showSparkle, setShowSparkle] = useState(false);

  if (owned !== prevOwned) {
    setPrevOwned(owned);
    if (owned) {
      setShowSparkle(true);
    }
  }

  useEffect(() => {
    if (!showSparkle) return;
    const timeout = setTimeout(() => setShowSparkle(false), SPARKLE_LIFETIME_MS);
    return () => clearTimeout(timeout);
  }, [showSparkle]);

  return showSparkle;
}

interface AnimatedCheckboxProps {
  owned: boolean;
  onToggle: () => void;
  label: string;
}

function AnimatedCheckbox({ owned, onToggle, label }: AnimatedCheckboxProps) {
  const showSparkle = useJustTicked(owned);

  return (
    <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
      <motion.button
        type="button"
        role="checkbox"
        aria-checked={owned}
        aria-label={label}
        onClick={(event) => {
          event.stopPropagation();
          onToggle();
        }}
        initial={false}
        animate={{ scale: owned ? 1 : 0.85 }}
        transition={owned ? { type: "spring", stiffness: 500, damping: 15 } : { duration: 0.15, ease: "easeOut" }}
        className="flex h-4 w-4 items-center justify-center rounded-[4px] border border-current"
      >
        <svg viewBox="0 0 24 24" className="h-3 w-3">
          <motion.path
            d="M4 12.5l5 5L20 6"
            fill="none"
            stroke="currentColor"
            strokeWidth={3.5}
            strokeLinecap="round"
            strokeLinejoin="round"
            initial={false}
            animate={{ pathLength: owned ? 1 : 0, opacity: owned ? 1 : 0 }}
            transition={owned ? { duration: 0.3, ease: "easeInOut" } : { duration: 0.15, ease: "easeOut" }}
          />
        </svg>
      </motion.button>

      {showSparkle &&
        SPARKLE_OFFSETS.map((offset, index) => (
          <motion.span
            key={index}
            className="pointer-events-none absolute left-1/2 top-1/2 h-1 w-1 rounded-full bg-current"
            initial={{ x: 0, y: 0, opacity: 1, scale: 1 }}
            animate={{ x: offset.x, y: offset.y, opacity: 0, scale: 0 }}
            transition={{ duration: 0.4, ease: "easeOut", delay: offset.delay }}
          />
        ))}
    </span>
  );
}

// The React-programmatic-set-value trick: bypasses React's tracked <input> value setter
// so dispatching a real "input" event afterward is picked up by React (and therefore
// react-hook-form's own onChange) as if the user had actually typed it.
function setNativeInputValue(input: HTMLInputElement, value: string) {
  const setter = Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set;
  setter?.call(input, value);
  input.dispatchEvent(new Event("input", { bubbles: true }));
}

// Simplest version of the "VND zero-suggestion" trick: only the very first digit typed
// into an empty price field is intercepted (rewritten to "{digit}000" with the cursor
// placed right before the zeros); every keystroke after that behaves like a plain text
// input, since the cursor sitting before "000" makes further typing insert in the right
// place naturally.
function handlePriceBeforeInput(event: FormEvent<HTMLInputElement>) {
  const input = event.currentTarget;
  const nativeEvent = event.nativeEvent as InputEvent;
  const data = nativeEvent.data;
  if (input.value === "" && data && /^[0-9]$/.test(data)) {
    event.preventDefault();
    setNativeInputValue(input, `${data}000`);
    input.setSelectionRange(1, 1);
  }
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
              <AnimatedCheckbox
                owned={item.owned}
                onToggle={() => handleToggleOwned(item)}
                label={`Đã sở hữu tập ${item.volume.volumeNumber}`}
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
    watch,
    formState: { errors, isSubmitting },
  } = useForm<EditVolumeFormInput, unknown, EditVolumeFormOutput>({
    resolver: zodResolver(editVolumeFormSchema),
    defaultValues: {
      edition: item.edition,
      price: item.price ?? "",
      purchaseDate: item.purchaseDate ? item.purchaseDate.slice(0, 10) : "",
    },
  });

  const priceValue = watch("price");
  const priceNumber = typeof priceValue === "string" ? Number(priceValue) : Number(priceValue ?? NaN);
  const pricePreview =
    Number.isFinite(priceNumber) && priceNumber > 0 ? `${new Intl.NumberFormat("vi-VN").format(priceNumber)} đ` : null;

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
              type="text"
              inputMode="decimal"
              autoComplete="off"
              className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
              {...register("price")}
              onBeforeInput={handlePriceBeforeInput}
            />
            {pricePreview && <p className="text-xs text-neutral-500">{pricePreview}</p>}
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
