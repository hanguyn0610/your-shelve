"use client";

import { useCallback, useState } from "react";
import { CSRF_HEADER } from "@/lib/security/csrf";

interface UseImageUploadResult {
  uploadImage: (file: File) => Promise<string>;
  isUploading: boolean;
  error: string | null;
}

async function parseErrorMessage(response: Response): Promise<string> {
  const data = await response.json().catch(() => null);
  return (data?.error as string | undefined) ?? "Có lỗi xảy ra, vui lòng thử lại";
}

export function useImageUpload(): UseImageUploadResult {
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const uploadImage = useCallback(async (file: File): Promise<string> => {
    setIsUploading(true);
    setError(null);
    try {
      const formData = new FormData();
      formData.append("file", file);

      // No Content-Type header here — the browser sets the correct multipart boundary
      // for FormData itself; setting it manually would break the upload.
      const response = await fetch("/api/upload", { method: "POST", headers: { ...CSRF_HEADER }, body: formData });
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      const data = (await response.json()) as { url: string };
      return data.url;
    } catch (err) {
      const message = err instanceof Error ? err.message : "Upload ảnh thất bại";
      setError(message);
      throw err instanceof Error ? err : new Error(message);
    } finally {
      setIsUploading(false);
    }
  }, []);

  return { uploadImage, isUploading, error };
}
