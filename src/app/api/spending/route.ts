import { NextResponse } from "next/server";
import { getAggregateSpending, DailySpending } from "@/lib/parser";

export const dynamic = "force-dynamic";

// Spending changes only when new step-finish events arrive. With the
// dashboard polling at 3s the 60s TTL was regenerating the full part-table
// scan almost continuously for no UI benefit. 5 minutes is still snappy
// enough for a Spending tab refresh and cuts the part-table scan by ~5x.
const CACHE_TTL_MS = 5 * 60_000;
let spendingCache: { days: number; data: DailySpending[]; expiresAt: number } | null = null;

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") || "30", 10), 90);

  const now = Date.now();
  if (spendingCache && spendingCache.days === days && spendingCache.expiresAt > now) {
    return NextResponse.json(spendingCache.data);
  }

  const data = getAggregateSpending(days);
  spendingCache = { days, data, expiresAt: now + CACHE_TTL_MS };
  return NextResponse.json(data);
}
