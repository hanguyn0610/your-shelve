"use client";

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react";
import * as authClient from "@/lib/auth/authClient";
import type { AuthUser } from "@/lib/auth/authClient";

interface AuthContextValue {
  user: AuthUser | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, displayName: string) => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // The access token lives in an httpOnly cookie now — JS can't read it to decide
    // upfront whether one exists, so this always asks the server; the browser attaches
    // the cookie automatically on this same-origin request.
    fetch("/api/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data: { user: AuthUser } | null) => setUser(data?.user ?? null))
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const data = await authClient.login(email, password);
    setUser(data.user);
  }, []);

  const register = useCallback(async (email: string, password: string, displayName: string) => {
    const data = await authClient.register(email, password, displayName);
    setUser(data.user);
  }, []);

  const logout = useCallback(async () => {
    await authClient.logout();
    setUser(null);
  }, []);

  return <AuthContext.Provider value={{ user, isLoading, login, register, logout }}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth phải được dùng bên trong AuthProvider");
  }
  return context;
}
