import { NextResponse } from "next/server";
import { searchSessions } from "@/lib/parser";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const q = searchParams.get("q") || "";
  const limit = Math.min(20, parseInt(searchParams.get("limit") || "20", 10));

  if (q.length < 2) return NextResponse.json({ error: "Query too short" }, { status: 400 });
  if (q.length > 200) return NextResponse.json({ error: "Query too long" }, { status: 400 });

  try {
    const results = searchSessions(q, limit);
    return NextResponse.json(results);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
