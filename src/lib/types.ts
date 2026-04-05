export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
  reasoningTokens: number;
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

export interface ModelBreakdown {
  count: number;
  cost: number;
  tokens: TokenUsage;
}

export interface MessageInfo {
  id: string;
  role: "user" | "assistant";
  timestamp: string;
  model?: string;
  providerID?: string;
  agent?: string;
  cost?: number;
  usage?: TokenUsage;
  stopReason?: string;
  toolCalls: string[];
  editedFiles?: string[];
  isSubagentMessage: boolean;
  textContent?: string;
}

export interface FileActivity {
  path: string;
  shortPath: string;
  reads: number;
  edits: number;
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

export interface SessionData {
  sessionId: string;
  projectPath: string;
  projectName: string;
  projectRoot: string | null;
  startTime: string;
  lastActivity: string;
  totalCost: number;
  totalTokens: TokenUsage;
  messageCount: number;
  modelBreakdown: Record<string, ModelBreakdown>;
  toolUsage: Record<string, number>;
  messages: MessageInfo[];
  agents: AgentInfo[];
  costOverTime: { timestamp: string; cumulativeCost: number; model: string }[];
  fileActivity: FileActivity[];
  costPerTurn: CostPerTurn[];
  timeline: TimelineEvent[];
  compactions: CompactionEvent[];
  contextSnapshots: ContextSnapshot[];
  contextLimit: number;
  slug: string;
}

export interface ProjectInfo {
  id: string;
  path: string;
  name: string;
  root: string | null;
  vcs: string | null;
  sessions: { id: string; title: string; modifiedAt: string; slug: string }[];
}

export interface DailySpending {
  date: string;
  cost: number;
  sessions: number;
  tokens: number;
  projectBreakdown: Record<string, number>;
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
  recentMessages: MessageInfo[];
  agentCount: number;
  activeAgentCount: number;
  slug: string;
}

export interface ProjectSpending {
  name: string;
  cost: number;
  sessions: number;
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

export interface GitDiffResponse {
  supported: boolean;
  error?: string;
  commits: { hash: string; shortHash: string; message: string; time: string }[];
  stat: string;
  filesChanged: number;
  insertions: number;
  deletions: number;
}
