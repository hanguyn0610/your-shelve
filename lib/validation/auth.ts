import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().min(1, "Email là bắt buộc").email("Email không hợp lệ"),
  password: z
    .string()
    .min(8, "Mật khẩu tối thiểu 8 ký tự")
    .regex(/\d/, "Mật khẩu phải có ít nhất 1 chữ số"),
  displayName: z
    .string()
    .min(2, "Tên hiển thị tối thiểu 2 ký tự")
    .max(50, "Tên hiển thị tối đa 50 ký tự"),
});

export const loginSchema = z.object({
  email: z.string().min(1, "Email là bắt buộc").email("Email không hợp lệ"),
  password: z.string().min(1, "Mật khẩu là bắt buộc"),
});

export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
