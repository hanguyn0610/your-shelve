"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { useTheme } from "@/lib/theme/ThemeContext";

function ThemeToggleButton() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";

  return (
    <button
      type="button"
      onClick={() => setTheme(isDark ? "light" : "dark")}
      aria-label={isDark ? "Chuyển sang giao diện sáng" : "Chuyển sang giao diện tối"}
      className="flex h-9 w-9 items-center justify-center rounded-md text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-900"
    >
      {isDark ? (
        // Sun — shown while dark is active, click to switch to light.
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" />
        </svg>
      ) : (
        // Moon — shown while light is active, click to switch to dark.
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          className="h-5 w-5"
          aria-hidden="true"
        >
          <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
        </svg>
      )}
    </button>
  );
}

export function NavBar() {
  const { user, isLoading, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!isMenuOpen) return;

    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsMenuOpen(false);
      }
    }

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isMenuOpen]);

  const handleLogout = async () => {
    setIsMenuOpen(false);
    await logout();
  };

  return (
    <header className="relative z-20 border-b border-neutral-200 dark:border-neutral-800">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4">
        <div className="flex items-center gap-6">
          <Link href="/" className="text-lg font-semibold">
            Your Shelve
          </Link>
          <nav className="hidden items-center gap-4 text-sm text-neutral-600 sm:flex dark:text-neutral-400">
            <Link href="/shelf" className="hover:text-foreground">
              Tủ sách
            </Link>
            <Link href="/news" className="hover:text-foreground">
              News
            </Link>
            <Link href="/calendar" className="hover:text-foreground">
              Lịch xuất bản
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-2">
          <ThemeToggleButton />

          <div className="relative" ref={menuRef}>
            {!isLoading &&
              (user ? (
                <>
                  <button
                    type="button"
                    onClick={() => setIsMenuOpen((open) => !open)}
                    className="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-900"
                  >
                    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-neutral-900 text-xs font-semibold text-white dark:bg-neutral-100 dark:text-neutral-900">
                      {user.displayName.charAt(0).toUpperCase()}
                    </span>
                    {user.displayName}
                  </button>

                  {isMenuOpen && (
                    <div className="absolute right-0 top-full mt-2 w-40 rounded-md border border-neutral-200 bg-background py-1 shadow-lg dark:border-neutral-800">
                      <Link
                        href="/dashboard"
                        className="block px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Thống kê
                      </Link>
                      <Link
                        href="/account"
                        className="block px-3 py-2 text-sm hover:bg-neutral-100 dark:hover:bg-neutral-900"
                        onClick={() => setIsMenuOpen(false)}
                      >
                        Cài đặt
                      </Link>
                      <button
                        type="button"
                        onClick={handleLogout}
                        className="block w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-neutral-100 dark:hover:bg-neutral-900"
                      >
                        Đăng xuất
                      </button>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3 text-sm">
                  <Link href="/login" className="hover:underline">
                    Đăng nhập
                  </Link>
                  <Link
                    href="/register"
                    className="rounded-md bg-neutral-900 px-3 py-1.5 font-medium text-white dark:bg-neutral-100 dark:text-neutral-900"
                  >
                    Đăng ký
                  </Link>
                </div>
              ))}
          </div>
        </div>
      </div>
    </header>
  );
}
