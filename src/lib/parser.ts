import Database from "better-sqlite3";
import { join } from "path";
import { homedir, platform } from "os";
import { existsSync, mkdirSync } from "fs";
import { getModelDisplayName } from "./pricing";

// ─── OpenCode DB path ────────────────────────────────────────────────────────

export function getOpenCodeDb(): string {
  const xdg = process.env.XDG_DATA_HOME;
  if (xdg) return join(xdg, "opencode", "opencode.db");
  if (platform() === "darwin") {
    return join(homedir(), "Library", "Application Support", "opencode", "opencode.db");
  }
  return join(homedir(), ".local", "share", "opencode", "opencode.db");
}

export function getInsightsDir(): string {
  const xdg = process.env.XDG_DATA_HOME;
  const base = xdg
    ? join(xdg, "opencode")
    : platform() === "darwin"
      ? join(homedir(), "Library", "Application Support", "opencode")
      : join(homedir(), ".local", "share", "opencode");
  if (!existsSync(base)) mkdirSync(base, { recursive: true });
  return base;
}

let _db: Database.Database | null = null;

function openDb(): Database.Database {
  if (_db) return _db;
  const path = getOpenCodeDb();
  if (!existsSync(path)) {
    throw new Error(`OpenCode database not found at ${path}. Have you run opencode at least once?`);
  }
  _db = new Database(path, { readonly: true, fileMustExist: true });
  return _db;
}

// ─── Raw DB row types ────────────────────────────────────────────────────────

interface DbProject {
  id: string;
  worktree: string;
  name: string | null;
  vcs: string | null;
  time_created: number;
  time_updated: number;
}

interface DbSession {
  id: string;
  project_id: string;
  parent_id: string | null;
  slug: string;
  directory: string;
  title: string;
  version: string;
  time_created: number;
  time_updated: number;
  summary_additions: number | null;
  summary_deletions: number | null;
  summary_files: number | null;
}

interface DbMessage {
  id: string;
  session_id: string;
  time_created: number;
  data: string;
}

interface DbPart {
  id: string;
  message_id: string;
  session_id: string;
  time_created: number;
  data: string;
}

// ─── Public types ─────────────────────────────────────────────────────────────

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  reasoningTokens: number;
}

export interface ParsedMessage {
  id: string;
  sessionId: string;
  role: "user" | "assistant";
  timestamp: string;
  model?: string;
  providerID?: string;
  agent?: string;
  cost?: number;
  usage?: TokenUsage;
  stopReason?: string;
  toolCalls: string[];
  editedFiles: string[];
  isSubagentMessage: boolean;
  textContent?: string;
}

export interface AgentInfo {
  id: string;
  parentSessionId: string;
  title: string;
  agentName?: string;
  status: "running" | "completed" | "unknown";
  totalCost: number;
  totalTokens: TokenUsage;
  startTime?: string;
  lastActivity?: string;
  model?: string;
  messageCount: number;
}

export interface FileActivity {
  path: string;
  shortPath: string;
  edits: number;
  reads: number;
  writes: number;
  total: number;
}

export interface CostPerTurn {
  turnIndex: number;
  userTimestamp: string;
  userContent: string;
  cost: number;
  tokens: number;
  assistantMessages: number;
  toolCalls: string[];
}

export interface TimelineEvent {
  timestamp: string;
  type: "user" | "assistant" | "tool" | "agent";
  toolName?: string;
  model?: string;
  cost?: number;
  agentName?: string;
}

export interface CompactionEvent {
  timestamp: string;
  auto: boolean;
  turnIndex: number;
}

export interface ContextSnapshot {
  timestamp: string;
  inputTokens: number;
}

export interface SessionSummary {
  sessionId: string;
  projectId: string;
  projectPath: string;
  projectName: string;
  projectRoot: string | null;
  startTime: string;
  lastActivity: string;
  totalCost: number;
  totalTokens: TokenUsage;
  messageCount: number;
  modelBreakdown: Record<string, { count: number; cost: number; tokens: TokenUsage }>;
  toolUsage: Record<string, number>;
  messages: ParsedMessage[];
  agents: AgentInfo[];
  costOverTime: { timestamp: string; cumulativeCost: number; model: string }[];
  fileActivity: FileActivity[];
  costPerTurn: CostPerTurn[];
  timeline: TimelineEvent[];
  compactions: CompactionEvent[];
  contextSnapshots: ContextSnapshot[];
  contextLimit: number;
  slug: string;
  gitSummary?: { additions: number; deletions: number; files: number };
}

export interface ProjectInfo {
  id: string;
  path: string;
  name: string;
  root: string | null;
  vcs: string | null;
  sessions: { id: string; title: string; modifiedAt: Date; slug: string }[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function shortenPath(filePath: string): string {
  const parts = filePath.split("/");
  if (parts.length <= 3) return filePath;
  return ".../" + parts.slice(-3).join("/");
}

function msToIso(ms: number): string {
  return new Date(ms).toISOString();
}

function projectName(worktree: string): string {
  const parts = worktree.split("/").filter(Boolean);
  return parts[parts.length - 1] || worktree;
}

function emptyTokens(): TokenUsage {
  return { inputTokens: 0, outputTokens: 0, cacheCreationTokens: 0, cacheReadTokens: 0, reasoningTokens: 0 };
}

function addTokens(a: TokenUsage, b: TokenUsage): TokenUsage {
  return {
    inputTokens: a.inputTokens + b.inputTokens,
    outputTokens: a.outputTokens + b.outputTokens,
    cacheCreationTokens: a.cacheCreationTokens + b.cacheCreationTokens,
    cacheReadTokens: a.cacheReadTokens + b.cacheReadTokens,
    reasoningTokens: a.reasoningTokens + b.reasoningTokens,
  };
}

function tokensFromRaw(raw: { input?: number; output?: number; reasoning?: number; cache?: { read?: number; write?: number } } | undefined): TokenUsage {
  if (!raw) return emptyTokens();
  return {
    inputTokens: raw.input ?? 0,
    outputTokens: raw.output ?? 0,
    cacheCreationTokens: raw.cache?.write ?? 0,
    cacheReadTokens: raw.cache?.read ?? 0,
    reasoningTokens: raw.reasoning ?? 0,
  };
}

// ─── Core parsing ─────────────────────────────────────────────────────────────

function parseSessionMessages(sessionId: string): ParsedMessage[] {
  const db = openDb();

  const msgRows = db
    .prepare<[string], DbMessage>(
      "SELECT id, session_id, time_created, data FROM message WHERE session_id = ? ORDER BY time_created ASC"
    )
    .all(sessionId);

  const partRows = db
    .prepare<[string], DbPart>(
      "SELECT id, message_id, session_id, time_created, data FROM part WHERE session_id = ? ORDER BY time_created ASC"
    )
    .all(sessionId);

  const partsByMsg = new Map<string, DbPart[]>();
  for (const p of partRows) {
    const arr = partsByMsg.get(p.message_id) ?? [];
    arr.push(p);
    partsByMsg.set(p.message_id, arr);
  }

  const parsed: ParsedMessage[] = [];

  for (const row of msgRows) {
    let msgData: Record<string, unknown>;
    try {
      msgData = JSON.parse(row.data);
    } catch {
      continue;
    }

    const parts = partsByMsg.get(row.id) ?? [];
    const toolCalls: string[] = [];
    const editedFiles: string[] = [];
    let stepCost = 0;
    let stepTokens = emptyTokens();
    let hasStepFinish = false;
    let textContent: string | undefined;

    for (const p of parts) {
      let partData: Record<string, unknown>;
      try {
        partData = JSON.parse(p.data);
      } catch {
        continue;
      }

      const ptype = partData.type as string;
      if (ptype === "tool") {
        const tool = partData.tool as string;
        if (tool && !toolCalls.includes(tool)) toolCalls.push(tool);
      } else if (ptype === "step-finish") {
        stepCost += (partData.cost as number) ?? 0;
        stepTokens = addTokens(stepTokens, tokensFromRaw(partData.tokens as Parameters<typeof tokensFromRaw>[0]));
        hasStepFinish = true;
      } else if (ptype === "patch") {
        const files = partData.files as string[] | undefined;
        if (Array.isArray(files)) editedFiles.push(...files);
      } else if (ptype === "text" && textContent === undefined) {
        textContent = partData.text as string;
      }
    }

    const role = msgData.role as string;
    if (role === "user") {
      const model = msgData.model as { providerID?: string; modelID?: string } | undefined;
      const summary = msgData.summary as { title?: string } | undefined;
      parsed.push({
        id: row.id,
        sessionId,
        role: "user",
        timestamp: msToIso(row.time_created),
        agent: msgData.agent as string | undefined,
        model: model?.modelID,
        providerID: model?.providerID,
        toolCalls: [],
        editedFiles: [],
        isSubagentMessage: false,
        textContent: textContent ?? summary?.title,
      });
    } else if (role === "assistant") {
      const rawTokens = msgData.tokens as Parameters<typeof tokensFromRaw>[0] | undefined;
      const cost = hasStepFinish ? stepCost : ((msgData.cost as number) ?? 0);
      const tokens = hasStepFinish ? stepTokens : tokensFromRaw(rawTokens);

      parsed.push({
        id: row.id,
        sessionId,
        role: "assistant",
        timestamp: msToIso(row.time_created),
        model: msgData.modelID as string | undefined,
        providerID: msgData.providerID as string | undefined,
        agent: (msgData.agent ?? msgData.mode) as string | undefined,
        cost,
        usage: tokens,
        stopReason: msgData.finish as string | undefined,
        toolCalls,
        editedFiles,
        isSubagentMessage: false,
        textContent,
      });
    }
  }

  return parsed;
}

// ─── Session analysis ────────────────────────────────────────────────────────

function analyzeSession(
  session: DbSession,
  project: DbProject,
  messages: ParsedMessage[],
  agents: AgentInfo[]
): SessionSummary {
  const totalTokens = emptyTokens();
  let totalCost = 0;
  const modelBreakdown: SessionSummary["modelBreakdown"] = {};
  const toolUsage: Record<string, number> = {};
  const costOverTime: SessionSummary["costOverTime"] = [];
  let cumulativeCost = 0;
  const fileMap = new Map<string, { edits: number; reads: number; writes: number }>();
  const timeline: TimelineEvent[] = [];
  const compactions: CompactionEvent[] = [];
  const contextSnapshots: ContextSnapshot[] = [];
  const costPerTurn: CostPerTurn[] = [];
  let currentTurn: CostPerTurn | null = null;
  let turnIndex = 0;
  const contextLimit = 200_000;

  const db = openDb();

  const compactionParts = db
    .prepare<[string], { time_created: number; data: string }>(
      "SELECT time_created, data FROM part WHERE session_id = ? AND json_extract(data, '$.type') = 'compaction' ORDER BY time_created ASC"
    )
    .all(session.id);

  const agentParts = db
    .prepare<[string], { time_created: number; data: string }>(
      "SELECT time_created, data FROM part WHERE session_id = ? AND json_extract(data, '$.type') = 'agent' ORDER BY time_created ASC"
    )
    .all(session.id);

  for (const p of agentParts) {
    try {
      const pd = JSON.parse(p.data) as { name: string };
      timeline.push({ timestamp: msToIso(p.time_created), type: "agent", agentName: pd.name });
    } catch {}
  }

  for (const p of compactionParts) {
    try {
      const pd = JSON.parse(p.data) as { auto?: boolean };
      compactions.push({ timestamp: msToIso(p.time_created), auto: pd.auto ?? true, turnIndex });
    } catch {}
  }

  for (const msg of messages) {
    if (msg.usage) {
      totalTokens.inputTokens += msg.usage.inputTokens;
      totalTokens.outputTokens += msg.usage.outputTokens;
      totalTokens.cacheCreationTokens += msg.usage.cacheCreationTokens;
      totalTokens.cacheReadTokens += msg.usage.cacheReadTokens;
      totalTokens.reasoningTokens += msg.usage.reasoningTokens;
    }
    if (msg.cost != null) {
      totalCost += msg.cost;
      cumulativeCost += msg.cost;
    }
    if (msg.model && msg.role === "assistant") {
      const dn = getModelDisplayName(msg.model);
      if (!modelBreakdown[dn]) modelBreakdown[dn] = { count: 0, cost: 0, tokens: emptyTokens() };
      modelBreakdown[dn].count++;
      if (msg.cost) modelBreakdown[dn].cost += msg.cost;
      if (msg.usage) modelBreakdown[dn].tokens = addTokens(modelBreakdown[dn].tokens, msg.usage);
    }
    for (const tool of msg.toolCalls) toolUsage[tool] = (toolUsage[tool] ?? 0) + 1;
    for (const fp of msg.editedFiles) {
      const entry = fileMap.get(fp) ?? { edits: 0, reads: 0, writes: 0 };
      entry.edits++;
      fileMap.set(fp, entry);
    }
    if (msg.cost != null && msg.role === "assistant") {
      costOverTime.push({ timestamp: msg.timestamp, cumulativeCost, model: msg.model ? getModelDisplayName(msg.model) : "Unknown" });
    }
    if (msg.usage && msg.role === "assistant") {
      const ti = msg.usage.inputTokens + msg.usage.cacheCreationTokens + msg.usage.cacheReadTokens;
      if (ti > 0) contextSnapshots.push({ timestamp: msg.timestamp, inputTokens: ti });
    }
    if (msg.role === "user") {
      timeline.push({ timestamp: msg.timestamp, type: "user" });
    } else if (msg.role === "assistant") {
      if (msg.toolCalls.length > 0) {
        for (const t of msg.toolCalls) timeline.push({ timestamp: msg.timestamp, type: "tool", toolName: t, model: msg.model, cost: msg.cost });
      } else {
        timeline.push({ timestamp: msg.timestamp, type: "assistant", model: msg.model, cost: msg.cost });
      }
    }
    if (msg.role === "user" && msg.textContent && !msg.textContent.startsWith("<")) {
      if (currentTurn) costPerTurn.push(currentTurn);
      currentTurn = { turnIndex: turnIndex++, userTimestamp: msg.timestamp, userContent: msg.textContent, cost: 0, tokens: 0, assistantMessages: 0, toolCalls: [] };
    } else if (currentTurn && msg.role === "assistant") {
      currentTurn.assistantMessages++;
      if (msg.cost) currentTurn.cost += msg.cost;
      if (msg.usage) currentTurn.tokens += msg.usage.inputTokens + msg.usage.outputTokens + msg.usage.cacheCreationTokens + msg.usage.cacheReadTokens;
      for (const t of msg.toolCalls) if (!currentTurn.toolCalls.includes(t)) currentTurn.toolCalls.push(t);
    }
  }
  if (currentTurn) costPerTurn.push(currentTurn);

  for (const agent of agents) {
    totalCost += agent.totalCost;
    totalTokens.inputTokens += agent.totalTokens.inputTokens;
    totalTokens.outputTokens += agent.totalTokens.outputTokens;
    totalTokens.cacheCreationTokens += agent.totalTokens.cacheCreationTokens;
    totalTokens.cacheReadTokens += agent.totalTokens.cacheReadTokens;
    totalTokens.reasoningTokens += agent.totalTokens.reasoningTokens;
  }

  const fileActivity: FileActivity[] = Array.from(fileMap.entries())
    .map(([path, c]) => ({ path, shortPath: shortenPath(path), edits: c.edits, reads: c.reads, writes: c.writes, total: c.edits + c.reads + c.writes }))
    .sort((a, b) => b.total - a.total);

  const timestamps = messages.map((m) => m.timestamp).filter(Boolean).sort();

  return {
    sessionId: session.id,
    projectId: session.project_id,
    projectPath: project.worktree,
    projectName: project.name ?? projectName(project.worktree),
    projectRoot: existsSync(project.worktree) ? project.worktree : null,
    startTime: timestamps[0] ?? msToIso(session.time_created),
    lastActivity: timestamps[timestamps.length - 1] ?? msToIso(session.time_updated),
    totalCost,
    totalTokens,
    messageCount: messages.length,
    modelBreakdown,
    toolUsage,
    messages,
    agents,
    costOverTime,
    fileActivity,
    costPerTurn,
    timeline: timeline.sort((a, b) => a.timestamp.localeCompare(b.timestamp)),
    compactions,
    contextSnapshots,
    contextLimit,
    slug: session.slug,
    gitSummary: session.summary_additions != null
      ? { additions: session.summary_additions ?? 0, deletions: session.summary_deletions ?? 0, files: session.summary_files ?? 0 }
      : undefined,
  };
}

// ─── Public API ──────────────────────────────────────────────────────────────

export function listProjects(): ProjectInfo[] {
  const db = openDb();
  const projects = db
    .prepare<[], DbProject>("SELECT id, worktree, name, vcs, time_created, time_updated FROM project ORDER BY time_updated DESC")
    .all();
  const sessions = db
    .prepare<[], DbSession>("SELECT id, project_id, parent_id, slug, directory, title, version, time_created, time_updated, summary_additions, summary_deletions, summary_files FROM session WHERE parent_id IS NULL ORDER BY time_updated DESC")
    .all();

  const byProject = new Map<string, DbSession[]>();
  for (const s of sessions) {
    const arr = byProject.get(s.project_id) ?? [];
    arr.push(s);
    byProject.set(s.project_id, arr);
  }

  return projects
    .filter((p) => (byProject.get(p.id) ?? []).length > 0)
    .map((p) => ({
      id: p.id,
      path: p.worktree,
      name: p.name ?? projectName(p.worktree),
      root: existsSync(p.worktree) ? p.worktree : null,
      vcs: p.vcs,
      sessions: (byProject.get(p.id) ?? []).map((s) => ({
        id: s.id,
        title: s.title,
        slug: s.slug,
        modifiedAt: new Date(s.time_updated),
      })),
    }));
}

export function getSessionData(sessionId: string): SessionSummary | null {
  const db = openDb();
  const session = db
    .prepare<[string], DbSession>("SELECT id, project_id, parent_id, slug, directory, title, version, time_created, time_updated, summary_additions, summary_deletions, summary_files FROM session WHERE id = ?")
    .get(sessionId);
  if (!session) return null;

  const project = db
    .prepare<[string], DbProject>("SELECT id, worktree, name, vcs, time_created, time_updated FROM project WHERE id = ?")
    .get(session.project_id);
  if (!project) return null;

  const messages = parseSessionMessages(sessionId);
  const childSessions = db
    .prepare<[string], DbSession>("SELECT id, project_id, parent_id, slug, directory, title, version, time_created, time_updated, summary_additions, summary_deletions, summary_files FROM session WHERE parent_id = ? ORDER BY time_created ASC")
    .all(sessionId);

  const agents: AgentInfo[] = childSessions.map((child) => {
    const childMsgs = parseSessionMessages(child.id);
    const totalTokens = emptyTokens();
    let totalCost = 0;
    let model: string | undefined;
    const timestamps = childMsgs.map((m) => m.timestamp).sort();
    for (const msg of childMsgs) {
      if (msg.usage) { totalTokens.inputTokens += msg.usage.inputTokens; totalTokens.outputTokens += msg.usage.outputTokens; totalTokens.cacheCreationTokens += msg.usage.cacheCreationTokens; totalTokens.cacheReadTokens += msg.usage.cacheReadTokens; totalTokens.reasoningTokens += msg.usage.reasoningTokens; }
      if (msg.cost) totalCost += msg.cost;
      if (msg.model && !model) model = msg.model;
    }
    const lastTs = timestamps[timestamps.length - 1];
    const timeSince = lastTs ? Date.now() - new Date(lastTs).getTime() : Infinity;
    const firstUser = childMsgs.find((m) => m.role === "user");
    return {
      id: child.id,
      parentSessionId: sessionId,
      title: child.title,
      agentName: firstUser?.agent,
      status: timeSince < 120_000 ? "running" : "completed",
      totalCost,
      totalTokens,
      startTime: timestamps[0],
      lastActivity: lastTs,
      model,
      messageCount: childMsgs.length,
    } satisfies AgentInfo;
  });

  return analyzeSession(session, project, messages, agents);
}

export interface DailySpending {
  date: string;
  cost: number;
  sessions: number;
  tokens: number;
  projectBreakdown: Record<string, number>;
}

export function getAggregateSpending(days = 30): DailySpending[] {
  const db = openDb();
  const cutoffMs = Date.now() - days * 24 * 60 * 60 * 1000;

  const rows = db
    .prepare<[number, number], {
      cost: number | null;
      inp: number | null;
      out: number | null;
      cw: number | null;
      cr: number | null;
      time_created: number;
      project_name: string | null;
      worktree: string;
      root_session_id: string;
    }>(
      `SELECT
        json_extract(p.data,'$.cost')              AS cost,
        json_extract(p.data,'$.tokens.input')      AS inp,
        json_extract(p.data,'$.tokens.output')     AS out,
        json_extract(p.data,'$.tokens.cache.write') AS cw,
        json_extract(p.data,'$.tokens.cache.read') AS cr,
        p.time_created,
        proj.name  AS project_name,
        proj.worktree,
        COALESCE(s.parent_id, s.id) AS root_session_id
      FROM part p
      JOIN session s   ON p.session_id = s.id
      JOIN project proj ON s.project_id = proj.id
      WHERE json_extract(p.data,'$.type') = 'step-finish'
        AND p.time_created >= ?
        AND s.time_updated >= ?`
    )
    .all(cutoffMs, cutoffMs);

  const dailyMap = new Map<string, DailySpending>();
  const sessionDates = new Map<string, string>();

  for (const row of rows) {
    if (row.cost == null) continue;
    const pName = row.project_name ?? projectName(row.worktree);
    const d = new Date(row.time_created);
    const date = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    const entry = dailyMap.get(date) ?? { date, cost: 0, sessions: 0, tokens: 0, projectBreakdown: {} };
    entry.cost += row.cost;
    entry.tokens += (row.inp ?? 0) + (row.out ?? 0) + (row.cw ?? 0) + (row.cr ?? 0);
    entry.projectBreakdown[pName] = (entry.projectBreakdown[pName] ?? 0) + row.cost;
    dailyMap.set(date, entry);
    sessionDates.set(row.root_session_id, date);
  }

  for (const date of sessionDates.values()) {
    const entry = dailyMap.get(date);
    if (entry) entry.sessions++;
  }

  return Array.from(dailyMap.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export interface ActiveSession {
  sessionId: string;
  projectId: string;
  projectPath: string;
  projectName: string;
  projectRoot: string | null;
  lastActivity: string;
  startTime: string;
  totalCost: number;
  totalTokens: TokenUsage;
  messageCount: number;
  model: string;
  isActive: boolean;
  recentMessages: ParsedMessage[];
  agentCount: number;
  activeAgentCount: number;
  slug: string;
}

export function getActiveSessions(thresholdMinutes = 10): ActiveSession[] {
  const db = openDb();
  const cutoffMs = Date.now() - thresholdMinutes * 60 * 1000;

  const sessions = db
    .prepare<[number], DbSession & { worktree: string; project_name: string | null }>(
      "SELECT s.id, s.project_id, s.parent_id, s.slug, s.directory, s.title, s.version, s.time_created, s.time_updated, s.summary_additions, s.summary_deletions, s.summary_files, p.worktree, p.name as project_name FROM session s JOIN project p ON s.project_id = p.id WHERE s.parent_id IS NULL AND s.time_updated >= ? ORDER BY s.time_updated DESC"
    )
    .all(cutoffMs);

  return sessions.map((session) => {
    const messages = parseSessionMessages(session.id);
    let totalCost = 0;
    const totalTokens = emptyTokens();
    const modelCounts: Record<string, number> = {};

    for (const msg of messages) {
      if (msg.cost) totalCost += msg.cost;
      if (msg.usage) { totalTokens.inputTokens += msg.usage.inputTokens; totalTokens.outputTokens += msg.usage.outputTokens; totalTokens.cacheCreationTokens += msg.usage.cacheCreationTokens; totalTokens.cacheReadTokens += msg.usage.cacheReadTokens; totalTokens.reasoningTokens += msg.usage.reasoningTokens; }
      if (msg.model) { const dm = getModelDisplayName(msg.model); modelCounts[dm] = (modelCounts[dm] ?? 0) + 1; }
    }

    const primaryModel = Object.entries(modelCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? "Unknown";
    const timestamps = messages.map((m) => m.timestamp).filter(Boolean).sort();
    const lastActivity = timestamps[timestamps.length - 1] ?? msToIso(session.time_updated);
    const isActive = new Date(lastActivity).getTime() > cutoffMs;
    const childCount = (db.prepare<[string], { cnt: number }>("SELECT COUNT(*) as cnt FROM session WHERE parent_id = ?").get(session.id)?.cnt) ?? 0;
    const activeChildCount = (db.prepare<[string, number], { cnt: number }>("SELECT COUNT(*) as cnt FROM session WHERE parent_id = ? AND time_updated >= ?").get(session.id, cutoffMs)?.cnt) ?? 0;
    const pName = session.project_name ?? projectName(session.worktree);

    return {
      sessionId: session.id,
      projectId: session.project_id,
      projectPath: session.worktree,
      projectName: pName,
      projectRoot: existsSync(session.worktree) ? session.worktree : null,
      lastActivity,
      startTime: timestamps[0] ?? msToIso(session.time_created),
      totalCost,
      totalTokens,
      messageCount: messages.length,
      model: primaryModel,
      isActive,
      recentMessages: messages.slice(-30),
      agentCount: childCount,
      activeAgentCount: activeChildCount,
      slug: session.slug,
    };
  }).sort((a, b) => {
    if (a.isActive !== b.isActive) return a.isActive ? -1 : 1;
    return new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime();
  });
}

export interface SearchResult {
  sessionId: string;
  projectPath: string;
  projectName: string;
  excerpt: string;
  timestamp: string;
  matchCount: number;
  slug: string;
}

function buildExcerpt(text: string, query: string): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query.toLowerCase());
  if (idx === -1) return text.slice(0, 120);
  const start = Math.max(0, idx - 60);
  const end = Math.min(text.length, idx + query.length + 60);
  return (start > 0 ? "..." : "") + text.slice(start, end) + (end < text.length ? "..." : "");
}

export function searchSessions(query: string, limit = 20): SearchResult[] {
  const db = openDb();
  const lowerQ = query.toLowerCase();

  const rows = db
    .prepare<[string, number], { session_id: string; worktree: string; project_name: string | null; slug: string; text_content: string; time_created: number }>(
      "SELECT p.session_id, proj.worktree, proj.name as project_name, s.slug, json_extract(p.data,'$.text') as text_content, p.time_created FROM part p JOIN session s ON p.session_id = s.id JOIN project proj ON s.project_id = proj.id WHERE json_extract(p.data,'$.type')='text' AND lower(json_extract(p.data,'$.text')) LIKE ? AND s.parent_id IS NULL ORDER BY p.time_created DESC LIMIT ?"
    )
    .all(`%${lowerQ}%`, limit * 5);

  const sessionMap = new Map<string, SearchResult>();
  for (const row of rows) {
    if (sessionMap.size >= limit && !sessionMap.has(row.session_id)) break;
    const existing = sessionMap.get(row.session_id);
    if (existing) {
      existing.matchCount++;
    } else {
      const pName = row.project_name ?? projectName(row.worktree);
      sessionMap.set(row.session_id, {
        sessionId: row.session_id,
        projectPath: row.worktree,
        projectName: pName,
        excerpt: buildExcerpt(row.text_content ?? "", query),
        timestamp: msToIso(row.time_created),
        matchCount: 1,
        slug: row.slug,
      });
    }
  }

  return Array.from(sessionMap.values())
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, limit);
}
