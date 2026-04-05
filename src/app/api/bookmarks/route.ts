import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { getInsightsDir } from "@/lib/parser";

export const dynamic = "force-dynamic";

function bookmarksPath(): string {
  return join(getInsightsDir(), "insights-bookmarks.json");
}

function readBookmarks(): string[] {
  try {
    const p = bookmarksPath();
    if (existsSync(p)) {
      const parsed = JSON.parse(readFileSync(p, "utf-8"));
      if (Array.isArray(parsed.bookmarks)) return parsed.bookmarks;
    }
  } catch {}
  return [];
}

function writeBookmarks(bookmarks: string[]) {
  writeFileSync(bookmarksPath(), JSON.stringify({ bookmarks }, null, 2), "utf-8");
}

export async function GET() {
  return NextResponse.json({ bookmarks: readBookmarks() });
}

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const { sessionId, starred } = body;

    if (!sessionId || typeof sessionId !== "string" || sessionId.length > 128 || !/^[A-Za-z0-9_-]+$/.test(sessionId)) {
      return NextResponse.json({ error: "Invalid sessionId" }, { status: 400 });
    }

    const current = readBookmarks();
    const updated = starred
      ? current.includes(sessionId) ? current : [...current, sessionId]
      : current.filter((id) => id !== sessionId);

    writeBookmarks(updated);
    return NextResponse.json({ bookmarks: updated });
  } catch {
    return NextResponse.json({ error: "Failed to update bookmarks" }, { status: 500 });
  }
}
