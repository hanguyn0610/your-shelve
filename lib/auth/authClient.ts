export interface AuthUser {
  id: string;
  email: string;
  displayName: string;
  language: string;
  currency: string;
  theme: string;
  createdAt: string;
}

export interface AuthResponse {
  user: AuthUser;
  accessToken: string;
  refreshToken: string;
}

async function parseErrorMessage(response: Response): Promise<string> {
  const data = await response.json().catch(() => null);
  return (data?.error as string | undefined) ?? "Có lỗi xảy ra, vui lòng thử lại";
}

// Auth is carried by the httpOnly cookies the server sets on the response (see
// lib/auth/setAuthCookies.ts) — this file no longer touches cookies itself, it
// only calls the API and hands the result back to AuthContext.
export async function login(email: string, password: string): Promise<AuthResponse> {
  const response = await fetch("/api/auth/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as AuthResponse;
}

export async function register(email: string, password: string, displayName: string): Promise<AuthResponse> {
  const response = await fetch("/api/auth/register", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, displayName }),
  });

  if (!response.ok) {
    throw new Error(await parseErrorMessage(response));
  }

  return (await response.json()) as AuthResponse;
}

export async function logout(): Promise<void> {
  // httpOnly cookies can't be cleared from client JS — the server has to do it.
  await fetch("/api/auth/logout", { method: "POST" });
}
