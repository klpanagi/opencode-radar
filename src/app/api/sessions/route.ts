import { NextResponse } from "next/server";
import { resolve, join } from "path";
import { listProjects, getSessionData, getClaudeDir } from "@/lib/parser";

export const dynamic = "force-dynamic";

// Validate that a resolved path stays within the projects directory
function isPathSafe(projectPath: string, sessionId: string): boolean {
  const projectsBase = resolve(join(getClaudeDir(), "projects"));
  const resolved = resolve(join(projectsBase, projectPath, `${sessionId}.jsonl`));
  return resolved.startsWith(projectsBase + "/");
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const projectPath = searchParams.get("project");
  const sessionId = searchParams.get("session");
  const includeFeed = searchParams.get("feed") === "1";

  // Return session detail
  if (projectPath && sessionId) {
    if (!isPathSafe(projectPath, sessionId)) {
      return NextResponse.json({ error: "Invalid path" }, { status: 400 });
    }
    const data = getSessionData(projectPath, sessionId);
    if (!data) {
      return NextResponse.json({ error: "Session not found" }, { status: 404 });
    }

    const lite = {
      ...data,
      messages: data.messages.map((m) => ({
        uuid: m.uuid,
        type: m.type,
        timestamp: m.timestamp,
        model: m.model,
        cost: m.cost,
        usage: m.usage,
        toolUse: m.toolUse ? { name: m.toolUse.name, input: includeFeed ? m.toolUse.input : undefined } : undefined,
        stopReason: m.stopReason,
        content: includeFeed ? m.content?.slice(0, 300) : undefined,
        isSidechain: m.isSidechain,
      })),
      agents: data.agents.map((a) => ({
        id: a.id,
        parentSessionId: a.parentSessionId,
        description: a.description,
        status: a.status,
        totalCost: a.totalCost,
        totalTokens: a.totalTokens,
        startTime: a.startTime,
        lastActivity: a.lastActivity,
        model: a.model,
        messageCount: a.messages.length,
      })),
    };
    return NextResponse.json(lite);
  }

  // Return project list
  const projects = listProjects();
  return NextResponse.json(projects);
}
