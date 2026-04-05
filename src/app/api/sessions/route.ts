import { NextResponse } from "next/server";
import { listProjects, getSessionData } from "@/lib/parser";

export const dynamic = "force-dynamic";

function isValidSessionId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,128}$/.test(id);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const sessionId = searchParams.get("session");
  const includeFeed = searchParams.get("feed") === "1";

  if (sessionId) {
    if (!isValidSessionId(sessionId)) {
      return NextResponse.json({ error: "Invalid session ID" }, { status: 400 });
    }
    try {
      const data = getSessionData(sessionId);
      if (!data) {
        return NextResponse.json({ error: "Session not found" }, { status: 404 });
      }
      const lite = {
        ...data,
        messages: data.messages.map((m) => ({
          id: m.id,
          role: m.role,
          timestamp: m.timestamp,
          model: m.model,
          providerID: m.providerID,
          agent: m.agent,
          cost: m.cost,
          usage: m.usage,
          stopReason: m.stopReason,
          toolCalls: m.toolCalls,
          editedFiles: includeFeed ? m.editedFiles : [],
          textContent: includeFeed ? m.textContent?.slice(0, 300) : undefined,
          isSubagentMessage: m.isSubagentMessage,
        })),
        agents: data.agents.map((a) => ({
          id: a.id,
          parentSessionId: a.parentSessionId,
          title: a.title,
          agentName: a.agentName,
          status: a.status,
          totalCost: a.totalCost,
          totalTokens: a.totalTokens,
          startTime: a.startTime,
          lastActivity: a.lastActivity,
          model: a.model,
          messageCount: a.messageCount,
        })),
      };
      return NextResponse.json(lite);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Unknown error";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  try {
    const projects = listProjects();
    return NextResponse.json(projects);
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
