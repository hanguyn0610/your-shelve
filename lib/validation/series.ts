import { z } from "zod";

export const createSeriesSchema = z.object({
  title: z.string().min(1, "Tiêu đề là bắt buộc").max(200, "Tiêu đề tối đa 200 ký tự"),
  coverUrl: z.string().url("coverUrl phải là URL hợp lệ").optional(),
  type: z.enum(["MANGA", "LIGHT_NOVEL"]),
  genres: z
    .array(z.string().min(1, "Thể loại không được rỗng").max(30, "Thể loại tối đa 30 ký tự"))
    .max(10, "Tối đa 10 thể loại")
    .default([]),
});

export const updateSeriesSchema = createSeriesSchema.partial();

// title/coverUrl/type/genres are deliberately NOT accepted from the client here — the
// route looks them up from AniList itself by anilistId, since this creates a SYSTEM
// Series shared by every user and a client could otherwise submit fabricated content
// for it (DevTools/curl) that everyone else would then see.
export const importSeriesSchema = z.object({
  anilistId: z.number().int("anilistId phải là số nguyên").positive("anilistId phải là số dương"),
});

export const createVolumeSchema = z.object({
  volumeNumber: z.number().int("volumeNumber phải là số nguyên").positive("volumeNumber phải là số dương"),
  releaseDate: z.string().date("releaseDate không hợp lệ (định dạng YYYY-MM-DD)").optional(),
});

export type CreateSeriesInput = z.infer<typeof createSeriesSchema>;
export type UpdateSeriesInput = z.infer<typeof updateSeriesSchema>;
export type ImportSeriesInput = z.infer<typeof importSeriesSchema>;
export type CreateVolumeInput = z.infer<typeof createVolumeSchema>;
