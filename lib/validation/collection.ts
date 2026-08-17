import { z } from "zod";

export const upsertCollectionSchema = z.object({
  owned: z.boolean(),
  edition: z.enum(["REGULAR", "SPECIAL", "COLLECTOR"]),
  price: z
    .number()
    .positive("price phải là số dương")
    .multipleOf(0.01, "price tối đa 2 chữ số thập phân")
    .optional(),
  purchaseDate: z.string().date("purchaseDate không hợp lệ (định dạng YYYY-MM-DD)").optional(),
});

export type UpsertCollectionInput = z.infer<typeof upsertCollectionSchema>;
