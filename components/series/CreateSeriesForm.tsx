"use client";

import { useState, type ChangeEvent, type KeyboardEvent } from "react";
import Image from "next/image";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { z } from "zod";
import { createSeriesSchema, type CreateSeriesInput } from "@/lib/validation/series";
import { useImageUpload } from "@/lib/hooks/useImageUpload";
import { useAuth } from "@/lib/auth/AuthContext";

const MAX_GENRE_LENGTH = 30;
const MAX_GENRES = 10;

// genres has a schema default([]), so its pre-validation (input) shape allows
// `undefined` while the post-validation (output, = CreateSeriesInput) shape always
// has an array — the form's raw field values need the input shape.
type CreateSeriesFormValues = z.input<typeof createSeriesSchema>;

export interface CreatedSeries {
  id: string;
  title: string;
  coverUrl: string | null;
  type: "MANGA" | "LIGHT_NOVEL";
  source: "SYSTEM" | "USER_CREATED";
  genres: string[];
  createdById: string | null;
}

interface CreateSeriesFormProps {
  onCreated: (series: CreatedSeries) => void;
}

async function parseErrorMessage(response: Response): Promise<string> {
  const data = await response.json().catch(() => null);
  return (data?.error as string | undefined) ?? "Có lỗi xảy ra, vui lòng thử lại";
}

export function CreateSeriesForm({ onCreated }: CreateSeriesFormProps) {
  const { user, isLoading: isAuthLoading } = useAuth();
  const { uploadImage, isUploading, error: uploadError } = useImageUpload();
  const [tagInput, setTagInput] = useState("");
  const [formError, setFormError] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm<CreateSeriesFormValues, unknown, CreateSeriesInput>({
    resolver: zodResolver(createSeriesSchema),
    defaultValues: { title: "", type: "MANGA", genres: [], coverUrl: undefined },
  });

  const genres = watch("genres") ?? [];
  const coverUrl = watch("coverUrl");

  const handleFileChange = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    try {
      const url = await uploadImage(file);
      setValue("coverUrl", url, { shouldValidate: true });
    } catch {
      // uploadImage already records the failure in its own error state.
    }
  };

  const addTag = () => {
    const trimmed = tagInput.trim();
    if (!trimmed || trimmed.length > MAX_GENRE_LENGTH || genres.length >= MAX_GENRES || genres.includes(trimmed)) {
      return;
    }
    setValue("genres", [...genres, trimmed], { shouldValidate: true });
    setTagInput("");
  };

  const removeTag = (tag: string) => {
    setValue(
      "genres",
      genres.filter((g) => g !== tag),
      { shouldValidate: true },
    );
  };

  const handleTagKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter") {
      event.preventDefault();
      addTag();
    }
  };

  const onSubmit = async (values: CreateSeriesInput) => {
    setFormError(null);
    try {
      const response = await fetch("/api/series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      const series = (await response.json()) as CreatedSeries;
      onCreated(series);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Có lỗi xảy ra, vui lòng thử lại");
    }
  };

  return (
    <div className="w-full max-w-lg">
      {!isAuthLoading && !user && (
        <p className="mb-4 rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-300">
          Bạn cần đăng nhập để tạo series mới.
        </p>
      )}

      <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
        <div className="space-y-1">
          <label htmlFor="title" className="text-sm font-medium">
            Tên series
          </label>
          <input
            id="title"
            type="text"
            className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700"
            {...register("title")}
          />
          {errors.title && <p className="text-sm text-red-600">{errors.title.message}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="type" className="text-sm font-medium">
            Loại
          </label>
          <select
            id="type"
            className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm dark:border-neutral-700"
            {...register("type")}
          >
            <option value="MANGA">Manga</option>
            <option value="LIGHT_NOVEL">Light Novel</option>
          </select>
          {errors.type && <p className="text-sm text-red-600">{errors.type.message}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="cover" className="text-sm font-medium">
            Ảnh bìa
          </label>
          <input
            id="cover"
            type="file"
            accept="image/jpeg,image/png,image/webp"
            onChange={handleFileChange}
            disabled={isUploading}
            className="block w-full text-sm"
          />
          {isUploading && <p className="text-sm text-neutral-500">Đang tải ảnh lên...</p>}
          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
          {coverUrl && !isUploading && (
            <div className="relative mt-2 h-40 w-28 overflow-hidden rounded-md border border-neutral-200 dark:border-neutral-800">
              <Image src={coverUrl} alt="Xem trước ảnh bìa" fill sizes="112px" className="object-cover" />
            </div>
          )}
          {errors.coverUrl && <p className="text-sm text-red-600">{errors.coverUrl.message}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="genreInput" className="text-sm font-medium">
            Thể loại
          </label>
          <input
            id="genreInput"
            type="text"
            value={tagInput}
            onChange={(event) => setTagInput(event.target.value)}
            onKeyDown={handleTagKeyDown}
            disabled={genres.length >= MAX_GENRES}
            placeholder="Nhập thể loại rồi nhấn Enter"
            className="w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 disabled:opacity-50 dark:border-neutral-700"
          />

          {genres.length > 0 && (
            <div className="mt-2 flex flex-wrap gap-2">
              {genres.map((tag) => (
                <span
                  key={tag}
                  className="flex items-center gap-1 rounded-full bg-neutral-100 px-3 py-1 text-xs font-medium dark:bg-neutral-900"
                >
                  {tag}
                  <button
                    type="button"
                    onClick={() => removeTag(tag)}
                    aria-label={`Xoá thể loại ${tag}`}
                    className="text-neutral-500 hover:text-neutral-900 dark:hover:text-neutral-100"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
          <p className="text-xs text-neutral-500">
            {genres.length}/{MAX_GENRES} thể loại
          </p>
          {errors.genres && <p className="text-sm text-red-600">{errors.genres.message}</p>}
        </div>

        {formError && <p className="text-sm text-red-600">{formError}</p>}

        <button
          type="submit"
          disabled={isSubmitting || isUploading}
          className="w-full rounded-md bg-neutral-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
        >
          {isSubmitting ? "Đang tạo..." : "Tạo series"}
        </button>
      </form>
    </div>
  );
}
