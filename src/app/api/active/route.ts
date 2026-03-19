import { NextResponse } from "next/server";
import { getActiveSessions } from "@/lib/parser";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minutes = parseInt(searchParams.get("minutes") || "10", 10);

  const sessions = getActiveSessions(Math.min(minutes, 60));

  // Slim down the response — send recent messages with content for the feed
  const result = sessions.map((s) => ({
    ...s,
    recentMessages: s.recentMessages.map((m) => ({
      uuid: m.uuid,
      type: m.type,
      timestamp: m.timestamp,
      model: m.model,
      cost: m.cost,
      usage: m.usage,
      toolUse: m.toolUse ? { name: m.toolUse.name, input: m.toolUse.input } : undefined,
      stopReason: m.stopReason,
      content: m.content?.slice(0, 200),
      isSidechain: m.isSidechain,
    })),
  }));

  return NextResponse.json(result);
}
