import type { Metadata } from "next";
import { headers } from "next/headers";
import { Geist, Geist_Mono } from "next/font/google";
import { AuthProvider } from "@/lib/auth/AuthContext";
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

export default async function RootLayout({ children }: LayoutProps<"/">) {
  // proxy.ts generates a fresh nonce per request and forwards it via this header (see
  // proxy.ts's CSP setup) — exposed here as a <meta> tag so any inline <script> this
  // app ever adds can read it and self-apply nonce={nonce}. Next.js's own inline
  // hydration script already gets the matching nonce automatically from the
  // Content-Security-Policy response header, so nothing currently needs it directly.
  const nonce = (await headers()).get("x-nonce");

  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>{nonce && <meta name="csp-nonce" content={nonce} />}</head>
      <body className="min-h-full flex flex-col">
        <AuthProvider>
          <NavBar />
          <PageTransition>{children}</PageTransition>
        </AuthProvider>
      </body>
    </html>
  );
}
