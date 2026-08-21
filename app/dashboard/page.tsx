"use client";

import Link from "next/link";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useAuth } from "@/lib/auth/AuthContext";
import { useCollectionStats } from "@/lib/hooks/useCollectionStats";

function formatCurrency(amount: number, currency: string): string {
  const locale = currency === "USD" ? "en-US" : "vi-VN";
  try {
    return new Intl.NumberFormat(locale, { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return `${amount} ${currency}`;
  }
}

export default function DashboardPage() {
  const { user } = useAuth();
  const { stats, isLoading, error } = useCollectionStats();
  const currency = user?.currency ?? "VND";

  return (
    <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-6">
      <h1 className="text-2xl font-semibold">Thống kê tủ sách</h1>

      {isLoading && <p className="mt-6 text-sm text-neutral-500">Đang tải...</p>}
      {error && <p className="mt-6 text-sm text-red-600">{error}</p>}

      {!isLoading && !error && stats && stats.totalVolumesOwned === 0 && (
        <div className="mt-6 rounded-lg border border-dashed border-neutral-300 p-8 text-center dark:border-neutral-700">
          <p className="text-sm text-neutral-500">Bạn chưa sở hữu tập nào để thống kê.</p>
          <Link href="/" className="mt-2 inline-block text-sm font-medium underline">
            Tìm sách để thêm vào tủ sách
          </Link>
        </div>
      )}

      {!isLoading && !error && stats && stats.totalVolumesOwned > 0 && (
        <>
          <div className="mt-6 grid grid-cols-2 gap-4">
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">Tổng chi tiêu</p>
              <p className="mt-1 text-2xl font-semibold">{formatCurrency(stats.totalSpent, currency)}</p>
            </div>
            <div className="rounded-lg border border-neutral-200 p-4 dark:border-neutral-800">
              <p className="text-sm text-neutral-500">Số tập đã sở hữu</p>
              <p className="mt-1 text-2xl font-semibold">{stats.totalVolumesOwned}</p>
            </div>
          </div>

          <section className="mt-6">
            <h2 className="text-base font-semibold">Chi tiêu theo tháng</h2>
            <div className="mt-3 h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={stats.spendingByMonth} margin={{ left: 8, right: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--foreground)" opacity={0.15} />
                  <XAxis dataKey="month" tick={{ fontSize: 12, fill: "var(--foreground)" }} />
                  <YAxis tick={{ fontSize: 12, fill: "var(--foreground)" }} width={48} />
                  <Tooltip
                    formatter={(value) => formatCurrency(Number(value), currency)}
                    contentStyle={{ background: "var(--background)", border: "1px solid currentColor", fontSize: 12 }}
                  />
                  <Line type="monotone" dataKey="total" stroke="var(--foreground)" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </section>

          {stats.topSeriesBySpending.length > 0 && (
            <section className="mt-6">
              <h2 className="text-base font-semibold">Chi nhiều nhất</h2>
              <div className="mt-3 h-64 w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stats.topSeriesBySpending} layout="vertical" margin={{ left: 16, right: 16 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--foreground)" opacity={0.15} />
                    <XAxis type="number" tick={{ fontSize: 12, fill: "var(--foreground)" }} />
                    <YAxis
                      type="category"
                      dataKey="title"
                      tick={{ fontSize: 12, fill: "var(--foreground)" }}
                      width={120}
                    />
                    <Tooltip
                      formatter={(value) => formatCurrency(Number(value), currency)}
                      contentStyle={{ background: "var(--background)", border: "1px solid currentColor", fontSize: 12 }}
                    />
                    <Bar dataKey="totalSpent" fill="var(--foreground)" radius={[0, 4, 4, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
