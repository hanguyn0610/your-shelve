"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth/AuthContext";

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
    </header>
  );
}
