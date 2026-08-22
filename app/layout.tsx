import type { Metadata } from "next";
import { headers } from "next/headers";
import Script from "next/script";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth/AuthContext";
import { ThemeProvider } from "@/lib/theme/ThemeContext";
import { NavBar } from "@/components/layout/NavBar";
import { PageTransition } from "@/components/layout/PageTransition";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Your Shelve",
  description: "Quản lý tủ sách manga/Light Novel của bạn",
};

// Runs before hydration, before first paint: applies the "dark" class synchronously
// from the OS-level preference so a system-dark visitor never sees a flash of the
// light theme while React boots up. This only covers the "nobody's logged in yet"
// case — a signed-in user's *saved* theme (which can differ from their OS setting)
// isn't known synchronously at this point (it only lives in the DB, read later via
// /api/auth/me), so it's applied slightly after, once AuthContext resolves — see
// lib/theme/ThemeContext.tsx. That's an inherent limit of not persisting theme to a
// cookie, not something this script can fix, and out of this task's scope.
const THEME_INIT_SCRIPT = `
  (function () {
    try {
      if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
        document.documentElement.classList.add('dark');
      }
    } catch (e) {}
  })();
`;

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // proxy.ts generates a fresh nonce per request and forwards it via this header (see
  // proxy.ts's CSP setup) — exposed here as a <meta> tag so any inline <script> this
  // app ever adds can read it and self-apply nonce={nonce}. Next.js's own inline
  // hydration script (and next/script below) already get the matching nonce
  // automatically from the Content-Security-Policy response header.
  const nonce = (await headers()).get("x-nonce");

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
      // The theme-init script above sets the "dark" class before React ever hydrates,
      // so the server-rendered class list and the client's first-paint class list
      // will legitimately differ — this is the officially recommended way to silence
      // React's hydration warning for just that expected mismatch on this one element,
      // without suppressing hydration-mismatch warnings anywhere else in the tree.
      suppressHydrationWarning
    >
      <head>{nonce && <meta name="csp-nonce" content={nonce} />}</head>
      <body className="min-h-full flex flex-col">
        <Script id="theme-init" strategy="beforeInteractive" nonce={nonce ?? undefined}>
          {THEME_INIT_SCRIPT}
        </Script>
        <AuthProvider>
          <ThemeProvider>
            <NavBar />
            <PageTransition>{children}</PageTransition>
          </ThemeProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
