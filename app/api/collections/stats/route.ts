import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth/getCurrentUser";

interface SpendingByMonthRow {
  month: string;
  total: string | number | null;
}

interface TopSeriesRow {
  title: string;
  total: string | number | null;
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

// The 12 most recent months, oldest first, ending at the current month — computed in
// UTC throughout so the boundary math doesn't depend on the server's local timezone.
function last12Months(): Date[] {
  const now = new Date();
  const months: Date[] = [];
  for (let i = 11; i >= 0; i--) {
    months.push(new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - i, 1)));
  }
  return months;
}

export async function GET(request: Request) {
  const userId = getCurrentUser(request);
  if (!userId) {
    return NextResponse.json({ error: "Bạn cần đăng nhập" }, { status: 401 });
  }

  const months = last12Months();
  const windowStart = months[0];

  // Every number here is aggregated in Postgres (aggregate/$queryRaw GROUP BY), never
  // by loading every UserCollection row and summing in JS — that would get slow as a
  // user's collection grows.
  const [summary, monthlyRows, topSeriesRows] = await Promise.all([
    prisma.userCollection.aggregate({
      where: { userId, owned: true },
      _sum: { price: true },
      _count: { _all: true },
    }),
    prisma.$queryRaw<SpendingByMonthRow[]>`
      SELECT TO_CHAR(DATE_TRUNC('month', "purchaseDate"), 'YYYY-MM') AS month, SUM(price) AS total
      FROM "UserCollection"
      WHERE "userId" = ${userId}
        AND owned = true
        AND price IS NOT NULL
        AND "purchaseDate" IS NOT NULL
        AND "purchaseDate" >= ${windowStart}
      GROUP BY month
      ORDER BY month
    `,
    prisma.$queryRaw<TopSeriesRow[]>`
      SELECT s.title AS title, SUM(uc.price) AS total
      FROM "UserCollection" uc
      JOIN "Volume" v ON v.id = uc."volumeId"
      JOIN "Series" s ON s.id = v."seriesId"
      WHERE uc."userId" = ${userId} AND uc.owned = true AND uc.price IS NOT NULL
      GROUP BY s.id, s.title
      ORDER BY total DESC
      LIMIT 5
    `,
  ]);

  // Postgres only returns rows for months that actually have spending — filling the
  // rest in with 0 here is just presentation continuity, not the aggregation itself.
  const monthlyTotals = new Map(monthlyRows.map((row) => [row.month, Number(row.total ?? 0)]));
  const spendingByMonth = months.map((date) => {
    const key = monthKey(date);
    return { month: key, total: monthlyTotals.get(key) ?? 0 };
  });

  const topSeriesBySpending = topSeriesRows.map((row) => ({
    title: row.title,
    totalSpent: Number(row.total ?? 0),
  }));

  return NextResponse.json({
    totalSpent: Number(summary._sum.price ?? 0),
    totalVolumesOwned: summary._count._all,
    spendingByMonth,
    topSeriesBySpending,
  });
}
