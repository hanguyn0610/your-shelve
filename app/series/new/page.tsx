"use client";

import { useRouter } from "next/navigation";
import { CreateSeriesForm, type CreatedSeries } from "@/components/series/CreateSeriesForm";

export default function NewSeriesPage() {
  const router = useRouter();

  const handleCreated = (series: CreatedSeries) => {
    // /series/[id] doesn't exist yet (planned for a later day) — pushing here anyway
    // is fine, it just 404s for now and starts working once that route is added.
    router.push(`/series/${series.id}`);
  };

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
      <h1 className="text-2xl font-semibold">Tự thêm sách</h1>
      <p className="mt-1 text-sm text-neutral-500">Thêm một series manga/Light Novel mới vào hệ thống.</p>

      <div className="mt-6">
        <CreateSeriesForm onCreated={handleCreated} />
      </div>
    </main>
  );
}
