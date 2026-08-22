"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { updateProfileSchema, changePasswordSchema, type UpdateProfileInput } from "@/lib/validation/account";
import { useAuth } from "@/lib/auth/AuthContext";
import type { AuthUser } from "@/lib/auth/authClient";
import { CSRF_HEADER } from "@/lib/security/csrf";

async function parseErrorMessage(response: Response): Promise<string> {
  const data = await response.json().catch(() => null);
  return (data?.error as string | undefined) ?? "Có lỗi xảy ra, vui lòng thử lại";
}

const inputClass =
  "w-full rounded-md border border-neutral-300 bg-transparent px-3 py-2 text-sm outline-none focus:border-neutral-500 dark:border-neutral-700";

function ProfileForm({ user }: { user: AuthUser }) {
  const { updateUser } = useAuth();
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<UpdateProfileInput>({
    resolver: zodResolver(updateProfileSchema),
    defaultValues: {
      displayName: user.displayName,
      language: user.language === "en" ? "en" : "vi",
      currency: user.currency === "USD" ? "USD" : "VND",
      theme: user.theme === "dark" ? "dark" : "light",
    },
  });

  const onSubmit = async (values: UpdateProfileInput) => {
    setFormError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...CSRF_HEADER },
        body: JSON.stringify(values),
      });
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      const data = (await response.json()) as { user: AuthUser };
      updateUser(data.user);
      setSuccessMessage("Đã lưu thay đổi.");
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Có lỗi xảy ra, vui lòng thử lại");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="displayName" className="text-sm font-medium">
          Tên hiển thị
        </label>
        <input id="displayName" type="text" className={inputClass} {...register("displayName")} />
        {errors.displayName && <p className="text-sm text-red-600">{errors.displayName.message}</p>}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <div className="space-y-1">
          <label htmlFor="language" className="text-sm font-medium">
            Ngôn ngữ
          </label>
          <select id="language" className={inputClass} {...register("language")}>
            <option value="vi">Tiếng Việt</option>
            <option value="en">English</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="currency" className="text-sm font-medium">
            Tiền tệ
          </label>
          <select id="currency" className={inputClass} {...register("currency")}>
            <option value="VND">VND</option>
            <option value="USD">USD</option>
          </select>
        </div>

        <div className="space-y-1">
          <label htmlFor="theme" className="text-sm font-medium">
            Giao diện
          </label>
          <select id="theme" className={inputClass} {...register("theme")}>
            <option value="light">Sáng</option>
            <option value="dark">Tối</option>
          </select>
        </div>
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {isSubmitting ? "Đang lưu..." : "Lưu thay đổi"}
      </button>
    </form>
  );
}

const changePasswordFormSchema = changePasswordSchema
  .extend({
    confirmNewPassword: z.string().min(1, "Vui lòng nhập lại mật khẩu mới"),
  })
  .refine((data) => data.newPassword === data.confirmNewPassword, {
    message: "Mật khẩu xác nhận không khớp",
    path: ["confirmNewPassword"],
  });

type ChangePasswordFormInput = z.infer<typeof changePasswordFormSchema>;

function PasswordForm() {
  const [formError, setFormError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<ChangePasswordFormInput>({
    resolver: zodResolver(changePasswordFormSchema),
    defaultValues: { currentPassword: "", newPassword: "", confirmNewPassword: "" },
  });

  const onSubmit = async (values: ChangePasswordFormInput) => {
    setFormError(null);
    setSuccessMessage(null);
    try {
      const response = await fetch("/api/users/me/password", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...CSRF_HEADER },
        body: JSON.stringify({
          currentPassword: values.currentPassword,
          newPassword: values.newPassword,
        }),
      });
      if (!response.ok) {
        throw new Error(await parseErrorMessage(response));
      }
      setSuccessMessage("Đã đổi mật khẩu.");
      reset();
    } catch (error) {
      setFormError(error instanceof Error ? error.message : "Có lỗi xảy ra, vui lòng thử lại");
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-1">
        <label htmlFor="currentPassword" className="text-sm font-medium">
          Mật khẩu hiện tại
        </label>
        <input
          id="currentPassword"
          type="password"
          autoComplete="current-password"
          className={inputClass}
          {...register("currentPassword")}
        />
        {errors.currentPassword && <p className="text-sm text-red-600">{errors.currentPassword.message}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="newPassword" className="text-sm font-medium">
          Mật khẩu mới
        </label>
        <input
          id="newPassword"
          type="password"
          autoComplete="new-password"
          className={inputClass}
          {...register("newPassword")}
        />
        {errors.newPassword && <p className="text-sm text-red-600">{errors.newPassword.message}</p>}
      </div>

      <div className="space-y-1">
        <label htmlFor="confirmNewPassword" className="text-sm font-medium">
          Xác nhận mật khẩu mới
        </label>
        <input
          id="confirmNewPassword"
          type="password"
          autoComplete="new-password"
          className={inputClass}
          {...register("confirmNewPassword")}
        />
        {errors.confirmNewPassword && <p className="text-sm text-red-600">{errors.confirmNewPassword.message}</p>}
      </div>

      {formError && <p className="text-sm text-red-600">{formError}</p>}
      {successMessage && <p className="text-sm text-green-600">{successMessage}</p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="rounded-md bg-neutral-900 px-4 py-2 text-sm font-medium text-white disabled:opacity-50 dark:bg-neutral-100 dark:text-neutral-900"
      >
        {isSubmitting ? "Đang đổi..." : "Đổi mật khẩu"}
      </button>
    </form>
  );
}

export default function AccountPage() {
  const { user, isLoading } = useAuth();

  return (
    <main className="mx-auto w-full max-w-lg flex-1 px-4 py-6">
      <h1 className="text-2xl font-semibold">Cài đặt tài khoản</h1>

      {isLoading && <p className="mt-6 text-sm text-neutral-500">Đang tải...</p>}

      {!isLoading && user && (
        <div className="mt-6 space-y-8">
          <section>
            <h2 className="text-base font-semibold">Thông tin cá nhân</h2>
            <div className="mt-3">
              <ProfileForm user={user} />
            </div>
          </section>

          <section className="border-t border-neutral-200 pt-6 dark:border-neutral-800">
            <h2 className="text-base font-semibold">Đổi mật khẩu</h2>
            <div className="mt-3">
              <PasswordForm />
            </div>
          </section>
        </div>
      )}
    </main>
  );
}
