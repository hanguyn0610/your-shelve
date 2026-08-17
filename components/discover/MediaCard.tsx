import Image from "next/image";
import type { AniListMedia } from "@/lib/anilist";

const FORMAT_LABEL: Record<string, string> = {
  MANGA: "Manga",
  NOVEL: "Light Novel",
};

export function MediaCard({ media }: { media: AniListMedia }) {
  const title = media.title.romaji ?? media.title.english ?? "Không có tên";

  return (
    <div className="flex flex-col overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-800">
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
      </div>
      <div className="p-2">
        <p className="line-clamp-2 text-sm font-medium">{title}</p>
      </div>
    </div>
  );
}
