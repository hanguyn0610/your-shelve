"use client";

import { createContext, useCallback, useContext, useEffect, useState, useSyncExternalStore, type ReactNode } from "react";
import { useAuth } from "@/lib/auth/AuthContext";
import { CSRF_HEADER } from "@/lib/security/csrf";
import type { AuthUser } from "@/lib/auth/authClient";

export type Theme = "light" | "dark";

const DARK_QUERY = "(prefers-color-scheme: dark)";

function subscribeToSystemTheme(onChange: () => void): () => void {
  const mediaQuery = window.matchMedia(DARK_QUERY);
  mediaQuery.addEventListener("change", onChange);
  return () => mediaQuery.removeEventListener("change", onChange);
}

function getSystemThemeSnapshot(): Theme {
  return window.matchMedia(DARK_QUERY).matches ? "dark" : "light";
}

// Matches the server's own render, which can't know the browser's OS preference —
// corrected right after hydration, same useSyncExternalStore pattern as
// usePrefersReducedMotion in PageTransition.tsx. The *visual* flash this would
// otherwise cause is separately avoided by the blocking inline script in
// app/layout.tsx, which sets the "dark" class on <html> before first paint; this hook
// is only responsible for React-side state (e.g. which icon the NavBar toggle shows).
function getSystemThemeServerSnapshot(): Theme {
  return "light";
}

function useSystemTheme(): Theme {
  return useSyncExternalStore(subscribeToSystemTheme, getSystemThemeSnapshot, getSystemThemeServerSnapshot);
}

function normalizeTheme(value: string | undefined): Theme {
  return value === "dark" ? "dark" : "light";
}

interface ThemeContextValue {
  theme: Theme;
  setTheme: (theme: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | null>(null);

export function ThemeProvider({ children }: { children: ReactNode }) {
  const { user, updateUser } = useAuth();
  const systemTheme = useSystemTheme();

  // The signed-in user's saved theme (from AuthContext), or null while signed out.
  const accountTheme: Theme | null = user ? normalizeTheme(user.theme) : null;

  // `override` is a manual choice (this toggle, or applied optimistically while a
  // save from the /account form is in flight) that takes priority over accountTheme
  // until the account theme itself genuinely changes — tracked via `syncedAccount`
  // using React's "adjusting state when a prop changes" pattern (compared during
  // render, not in an effect) so this reacts to every source of change: login,
  // logout, this toggle, or the /account form — all of which funnel through
  // AuthContext's user.theme via updateUser().
  const [override, setOverride] = useState<Theme | null>(null);
  const [syncedAccount, setSyncedAccount] = useState<Theme | null>(null);
  if (accountTheme !== syncedAccount) {
    setSyncedAccount(accountTheme);
    setOverride(null);
  }

  const theme: Theme = override ?? accountTheme ?? systemTheme;

  // The one DOM mutation point — covers every way `theme` can change (toggle, login
  // resolving, /account form save, logout, OS-level preference change while signed
  // out). The blocking script in app/layout.tsx already set the correct class before
  // first paint for the signed-out case; this keeps it correct as things change.
  useEffect(() => {
    document.documentElement.classList.toggle("dark", theme === "dark");
  }, [theme]);

  const setTheme = useCallback(
    (next: Theme) => {
      // Applied immediately — the effect above reacts to `theme` on the very next
      // render, not after the PATCH below resolves.
      setOverride(next);

      if (!user) return;

      fetch("/api/users/me", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", ...CSRF_HEADER },
        body: JSON.stringify({ theme: next }),
      })
        .then((response) => (response.ok ? response.json() : null))
        .then((data: { user: AuthUser } | null) => {
          if (data?.user) updateUser(data.user);
        })
        .catch(() => {
          // Best-effort persistence — <html> already reflects the choice either way;
          // a failed PATCH just means it won't survive the next reload.
        });
    },
    [user, updateUser],
  );

  return <ThemeContext.Provider value={{ theme, setTheme }}>{children}</ThemeContext.Provider>;
}

export function useTheme(): ThemeContextValue {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error("useTheme phải được dùng bên trong ThemeProvider");
  }
  return context;
}
