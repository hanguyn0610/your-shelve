import { z } from "zod";

// Deliberately whitelist-only: no email/passwordHash/id here, ever. The API route
// passes this schema's parsed output straight into Prisma's `data`, so anything not
// listed here structurally cannot be mass-assigned through this endpoint.
export const updateProfileSchema = z.object({
  displayName: z.string().min(2, "Tên hiển thị tối thiểu 2 ký tự").max(50, "Tên hiển thị tối đa 50 ký tự").optional(),
  language: z.enum(["vi", "en"]).optional(),
  currency: z.enum(["VND", "USD"]).optional(),
  theme: z.enum(["light", "dark"]).optional(),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, "Mật khẩu hiện tại là bắt buộc"),
  // Same rule as registerSchema's password: min 8 chars, at least 1 digit.
  newPassword: z.string().min(8, "Mật khẩu tối thiểu 8 ký tự").regex(/\d/, "Mật khẩu phải có ít nhất 1 chữ số"),
});

export type UpdateProfileInput = z.infer<typeof updateProfileSchema>;
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>;
