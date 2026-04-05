import { NextResponse } from "next/server";
import { getActiveSessions } from "@/lib/parser";

export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const minutes = parseInt(searchParams.get("minutes") || "10", 10);

  try {
    const sessions = getActiveSessions(Math.min(minutes, 60));
    const result = sessions.map((s) => ({
      ...s,
      recentMessages: s.recentMessages.map((m) => ({
        id: m.id,
        role: m.role,
        timestamp: m.timestamp,
        model: m.model,
        agent: m.agent,
        cost: m.cost,
        usage: m.usage,
        toolCalls: m.toolCalls,
        textContent: m.textContent?.slice(0, 200),
        stopReason: m.stopReason,
        isSubagentMessage: m.isSubagentMessage,
      })),
    }));
    return NextResponse.json(result);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
