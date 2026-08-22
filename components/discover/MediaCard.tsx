"use client";

import type { MouseEvent } from "react";
import Image from "next/image";
import Link from "next/link";
import { motion } from "framer-motion";
import type { AniListMedia } from "@/lib/anilist";
import { useImportSeries } from "@/lib/hooks/useImportSeries";

const FORMAT_LABEL: Record<string, string> = {
  MANGA: "Manga",
  NOVEL: "Light Novel",
};

export function MediaCard({ media }: { media: AniListMedia }) {
  const { isImporting, error, importSeries } = useImportSeries();
  const title = media.title.romaji ?? media.title.english ?? "Không có tên";

  const handleClick = (event: MouseEvent) => {
    event.preventDefault();
    void importSeries(media.id);
  };

  return (
    <Link href="#" onClick={handleClick} className="block">
      <motion.div
        whileHover={{ scale: 1.02, y: -4, zIndex: 10 }}
        transition={{ type: "spring", stiffness: 300, damping: 20 }}
        className="relative flex flex-col overflow-hidden rounded-xl border border-neutral-300 shadow-md transition-all duration-200 hover:border-neutral-400 hover:shadow-xl dark:border-neutral-700 dark:hover:border-neutral-600"
      >
        <div className="relative aspect-2/3 w-full bg-neutral-100 dark:bg-neutral-900">
          {media.coverImage.large && (
            <Image
              src={media.coverImage.large}
              alt={title}
              fill
              sizes="(min-width: 1024px) 200px, (min-width: 640px) 25vw, 50vw"
              className="object-cover"
            />
          )}
          <span className="absolute left-2 top-2 rounded bg-black/70 px-2 py-0.5 text-xs font-medium text-white">
            {FORMAT_LABEL[media.format] ?? media.format}
          </span>
          {isImporting && (
            <span className="absolute inset-0 flex items-center justify-center bg-black/50 text-xs font-medium text-white">
              Đang thêm...
            </span>
          )}
        </div>
        <div className="p-2">
          <p className="line-clamp-2 text-sm font-medium">{title}</p>
          {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
        </div>
      </motion.div>
    </Link>
  );
}
