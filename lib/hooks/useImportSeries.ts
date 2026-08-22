"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth/AuthContext";
import { CSRF_HEADER } from "@/lib/security/csrf";

async function parseErrorMessage(response: Response): Promise<string> {
  const data = await response.json().catch(() => null);
  return (data?.error as string | undefined) ?? "Có lỗi xảy ra, vui lòng thử lại";
}

interface UseImportSeriesResult {
  isImporting: boolean;
  error: string | null;
  importSeries: (anilistId: number) => Promise<void>;
}

// Shared by MediaCard and SearchBar: import a Series from AniList by id and navigate to
// its detail page, redirecting to /login first if nobody's signed in.
export function useImportSeries(): UseImportSeriesResult {
  const router = useRouter();
  const { user, isLoading: isAuthLoading } = useAuth();
  const [isImporting, setIsImporting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const importSeries = async (anilistId: number) => {
    if (isImporting) return;

    // The destination isn't known until the import call resolves (new vs. already-
    // imported Series get the same DB id either way), so callers can't use a plain
    // <Link href> for this — they wrap it in one anyway for the usual clickable-card
    // styling and call this from an onClick that preventDefault()s the navigation.
    if (!isAuthLoading && !user) {
      router.push(`/login?redirectTo=${encodeURIComponent("/")}`);
      return;
    }

    setIsImporting(true);
    setError(null);
    try {
      // The route looks up title/coverUrl/type/genres from AniList itself by this id
      // — it doesn't trust client-submitted values for SYSTEM data shared by everyone.
      const response = await fetch("/api/series/import", {
        method: "POST",
        headers: { "Content-Type": "application/json", ...CSRF_HEADER },
        body: JSON.stringify({ anilistId }),
      });
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      const series = (await response.json()) as { id: string };
      router.push(`/series/${series.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Có lỗi xảy ra, vui lòng thử lại");
      setIsImporting(false);
    }
  };

  return { isImporting, error, importSeries };
}
