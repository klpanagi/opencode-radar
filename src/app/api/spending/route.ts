import { NextResponse } from "next/server";
import { getAggregateSpending } from "@/lib/parser";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = parseInt(searchParams.get("days") || "30", 10);
  const data = getAggregateSpending(Math.min(days, 90));
  return NextResponse.json(data);
}
