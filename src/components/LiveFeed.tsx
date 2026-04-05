"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { MessageInfo, SessionData } from "@/lib/types";

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

function getModelLabel(model?: string): string {
  if (!model) return "";
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model;
}

function shortenPath(p: string): string {
  const parts = p.split("/");
  if (parts.length <= 2) return p;
  return parts.slice(-2).join("/");
}

// ─── Feed item types ─────────────────────────────────────────────────────────

interface FeedItem {
  id: string;
  timestamp: string;
  type: "user" | "assistant" | "tool" | "bash" | "agent-spawn" | "system" | "cost-tick";
  icon: string;
  iconColor: string;
  label: string;
  detail?: string;
  meta?: string;
  cost?: number;
  success?: boolean;
}

const TOOL_ICON_MAP: Record<string, { icon: string; color: string }> = {
  Bash: { icon: "terminal", color: "#fb923c" },
  Read: { icon: "eye", color: "#60a5fa" },
  Edit: { icon: "pencil", color: "#a78bfa" },
  Write: { icon: "plus", color: "#4ade80" },
  Glob: { icon: "search", color: "#fbbf24" },
  Grep: { icon: "search", color: "#f472b6" },
  task: { icon: "agent", color: "#f472b6" },
};

function buildFeedItems(messages: MessageInfo[]): FeedItem[] {
  const items: FeedItem[] = [];
  let runningCost = 0;
  let lastCostTick = 0;

  for (const msg of messages) {
    if (!msg.timestamp) continue;
    if (msg.isSubagentMessage) continue;

    if (msg.role === "user" && msg.textContent && !msg.textContent.startsWith("<")) {
      items.push({
        id: msg.id,
        timestamp: msg.timestamp,
        type: "user",
        icon: "user",
        iconColor: "#3b82f6",
        label: "You",
        detail: msg.textContent.slice(0, 200),
      });
    } else if (msg.role === "assistant" && msg.toolCalls.length > 0) {
      for (const tool of msg.toolCalls) {
        const { icon, color } = TOOL_ICON_MAP[tool] ?? { icon: "tool", color: "#8888a4" };
        const isAgent = tool === "task";
        items.push({
          id: `${msg.id}-${tool}`,
          timestamp: msg.timestamp,
          type: isAgent ? "agent-spawn" : tool === "Bash" ? "bash" : "tool",
          icon,
          iconColor: color,
          label: isAgent ? "Agent Spawned" : tool,
          detail: "",
          meta: getModelLabel(msg.model),
          cost: msg.cost,
        });
      }
    } else if (msg.role === "assistant" && msg.toolCalls.length === 0 && msg.textContent) {
      items.push({
        id: msg.id,
        timestamp: msg.timestamp,
        type: "assistant",
        icon: "claude",
        iconColor: "#a78bfa",
        label: "OpenCode",
        detail: msg.textContent.slice(0, 200),
        meta: getModelLabel(msg.model),
        cost: msg.cost,
      });
    }

    if (msg.cost) {
      runningCost += msg.cost;
      const tick = Math.floor(runningCost / 0.5);
      if (tick > lastCostTick) {
        lastCostTick = tick;
        items.push({
          id: `cost-${msg.id}`,
          timestamp: msg.timestamp,
          type: "cost-tick",
          icon: "dollar",
          iconColor: "#4ade80",
          label: `Running cost: ${formatCost(runningCost)}`,
        });
      }
    }
  }

  return items;
}

// ─── Icons ───────────────────────────────────────────────────────────────────

function FeedIcon({ icon, color, size = 16 }: { icon: string; color: string; size?: number }) {
  const s = size;
  const sw = 2;

  const paths: Record<string, React.ReactNode> = {
    user: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />,
    claude: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />,
    terminal: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d="M6 9l6 6" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d="M6 15l6-6" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d="M15 15h3" /></>,
    eye: <><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></>,
    pencil: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931zm0 0L19.5 7.125" />,
    plus: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m3.75 9v6m3-3H9m1.5-12H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />,
    search: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607z" />,
    agent: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />,
    dollar: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />,
    tool: <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={sw} d="M11.42 15.17l-5.66 5.66a2.12 2.12 0 01-3-3l5.66-5.66m3-3l5.66-5.66a2.12 2.12 0 013 3l-5.66 5.66" />,
  };

  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={color} className="shrink-0">
      {paths[icon] || paths.tool}
    </svg>
  );
}

// ─── Feed Item Component ─────────────────────────────────────────────────────

function FeedItemRow({ item, isLast }: { item: FeedItem; isLast: boolean }) {
  const isUser = item.type === "user";
  const isCostTick = item.type === "cost-tick";

  if (isCostTick) {
    return (
      <div className="flex items-center gap-3 py-1.5 pl-1">
        <div className="flex w-6 justify-center">
          <div className="h-px w-3 bg-[var(--border)]" />
        </div>
        <div className="flex items-center gap-2 text-[10px] text-[var(--accent-green)] font-medium">
          <FeedIcon icon="dollar" color="#4ade80" size={12} />
          {item.label}
        </div>
      </div>
    );
  }

  return (
    <div className="group flex gap-3">
      {/* Timeline line + icon */}
      <div className="flex flex-col items-center">
        <div
          className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full border transition-colors ${
            isUser
              ? "border-[#3b82f680] bg-[#3b82f615]"
              : "border-[var(--border)] bg-[var(--bg-secondary)] group-hover:border-[var(--text-secondary)]"
          }`}
        >
          <FeedIcon icon={item.icon} color={item.iconColor} size={14} />
        </div>
        {!isLast && (
          <div className="w-px flex-1 bg-[var(--border)] min-h-[8px]" />
        )}
      </div>

      {/* Content */}
      <div className={`min-w-0 flex-1 pb-4 ${isLast ? "" : ""}`}>
        <div className="flex items-baseline justify-between gap-2">
          <div className="flex items-center gap-2">
            <span
              className="text-xs font-semibold"
              style={{ color: item.iconColor }}
            >
              {item.label}
            </span>
            {item.meta && (
              <span className="rounded bg-[var(--bg-secondary)] px-1.5 py-0.5 text-[9px] text-[var(--text-secondary)]">
                {item.meta}
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {item.cost != null && item.cost > 0 && (
              <span className="text-[9px] text-[var(--accent-green)]">
                {formatCost(item.cost)}
              </span>
            )}
            <span className="text-[10px] text-[var(--text-secondary)]">
              {formatTime(item.timestamp)}
            </span>
          </div>
        </div>

        {item.detail && (
          <div
            className={`mt-1 text-xs leading-relaxed ${
              isUser
                ? "rounded-lg bg-[#3b82f610] border border-[#3b82f620] px-3 py-2 text-[var(--text-primary)]"
                : item.type === "bash"
                  ? "rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] px-3 py-2 font-mono text-[11px] text-[var(--accent-orange)]"
                  : item.type === "assistant"
                    ? "text-[var(--text-secondary)] line-clamp-3"
                    : "font-mono text-[11px] text-[var(--text-secondary)]"
            }`}
          >
            {item.detail}
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Mini Status Bar (collapsed view) ────────────────────────────────────────

function MiniStatus({ session, lastItem }: { session: SessionData; lastItem?: FeedItem }) {
  return (
    <div className="flex items-center gap-3 text-[11px]">
      <div className="flex items-center gap-1.5">
        <span className="h-2 w-2 animate-pulse-slow rounded-full bg-[var(--accent-green)]" />
        <span className="text-[var(--accent-green)] font-semibold">
          {formatCost(session.totalCost)}
        </span>
      </div>
      <span className="text-[var(--text-secondary)]">
        {formatTokens(session.totalTokens.inputTokens + session.totalTokens.outputTokens)} tokens
      </span>
      {lastItem && (
        <span className="truncate text-[var(--text-secondary)] max-w-[200px]">
          <span style={{ color: lastItem.iconColor }}>{lastItem.label}</span>
          {lastItem.detail ? `: ${lastItem.detail.slice(0, 40)}` : ""}
        </span>
      )}
    </div>
  );
}

// ─── Main LiveFeed Component ─────────────────────────────────────────────────

type FeedMode = "collapsed" | "panel" | "fullscreen";

export function LiveFeed({
  projectPath,
  sessionId,
  session,
}: {
  projectPath: string | null;
  sessionId: string | null;
  session: SessionData | null;
}) {
  const [mode, setMode] = useState<FeedMode>("collapsed");
  const [feedData, setFeedData] = useState<MessageInfo[]>([]);
  const [autoScroll, setAutoScroll] = useState(true);
  const scrollRef = useRef<HTMLDivElement>(null);
  const prevCountRef = useRef(0);

  // Fetch feed data (with content)
  const fetchFeed = useCallback(() => {
    if (!sessionId) return;
    fetch(
      `/api/sessions?session=${encodeURIComponent(sessionId)}&feed=1`
    )
      .then((r) => r.json())
      .then((data) => {
        if (!data.error && data.messages) {
          setFeedData(data.messages);
        }
      })
      .catch(() => {});
  }, [sessionId]);

  useEffect(() => {
    fetchFeed();
  }, [fetchFeed]);

  // Poll for updates
  useEffect(() => {
    if (mode === "collapsed") return;
    const interval = setInterval(fetchFeed, 2000);
    return () => clearInterval(interval);
  }, [mode, fetchFeed]);

  // Auto-scroll when new items arrive
  useEffect(() => {
    if (autoScroll && scrollRef.current && feedData.length > prevCountRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
    prevCountRef.current = feedData.length;
  }, [feedData, autoScroll]);

  const feedItems = buildFeedItems(feedData);
  const lastItem = feedItems[feedItems.length - 1];

  if (!sessionId) return null;

  // ── Collapsed: small bar at bottom-right ──
  if (mode === "collapsed") {
    return (
      <div className="fixed bottom-4 right-4 z-40">
        <button
          onClick={() => setMode("panel")}
          className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] px-4 py-2.5 shadow-lg transition-all hover:border-[var(--accent-purple)] hover:shadow-xl"
        >
          <svg className="h-4 w-4 text-[var(--accent-purple)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25H12" />
          </svg>
          {session ? (
            <MiniStatus session={session} lastItem={lastItem} />
          ) : (
            <span className="text-[11px] text-[var(--text-secondary)]">Live Feed</span>
          )}
          <svg className="h-3 w-3 text-[var(--text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.5 15.75l7.5-7.5 7.5 7.5" />
          </svg>
        </button>
      </div>
    );
  }

  // ── Panel or Fullscreen ──
  const isFullscreen = mode === "fullscreen";

  return (
    <div
      className={`fixed z-50 flex flex-col border border-[var(--border)] bg-[var(--bg-card)] shadow-2xl transition-all ${
        isFullscreen
          ? "inset-0 rounded-none"
          : "bottom-4 right-4 h-[520px] w-[440px] rounded-2xl"
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-3 shrink-0">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 animate-pulse-slow rounded-full bg-[var(--accent-green)]" />
          <span className="text-xs font-bold text-[var(--text-primary)]">Live Feed</span>
          {session && (
            <span className="text-[10px] text-[var(--text-secondary)]">
              {session.projectName}
            </span>
          )}
        </div>
        <div className="flex items-center gap-1">
          {/* Auto-scroll toggle */}
          <button
            onClick={() => setAutoScroll(!autoScroll)}
            className={`rounded-lg p-1.5 transition-colors ${
              autoScroll ? "text-[var(--accent-green)]" : "text-[var(--text-secondary)]"
            } hover:bg-[var(--bg-secondary)]`}
            title={autoScroll ? "Auto-scroll on" : "Auto-scroll off"}
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
          </button>

          {/* Fullscreen toggle */}
          <button
            onClick={() => setMode(isFullscreen ? "panel" : "fullscreen")}
            className="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen"}
          >
            {isFullscreen ? (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 9V4.5M9 9H4.5M9 9L3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5l5.25 5.25" />
              </svg>
            ) : (
              <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
            )}
          </button>

          {/* Minimize */}
          <button
            onClick={() => setMode("collapsed")}
            className="rounded-lg p-1.5 text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-secondary)] hover:text-[var(--text-primary)]"
            title="Minimize"
          >
            <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
            </svg>
          </button>
        </div>
      </div>

      {/* Summary bar */}
      {session && (
        <div className="flex items-center gap-4 border-b border-[var(--border)] bg-[var(--bg-secondary)] px-4 py-2 text-[10px] shrink-0">
          <span className="text-[var(--accent-green)] font-bold">{formatCost(session.totalCost)}</span>
          <span className="text-[var(--text-secondary)]">
            {formatTokens(session.totalTokens.inputTokens + session.totalTokens.outputTokens)} tokens
          </span>
          <span className="text-[var(--text-secondary)]">{feedItems.filter((i) => i.type === "user").length} turns</span>
          <span className="text-[var(--text-secondary)]">{feedItems.filter((i) => i.type === "tool" || i.type === "bash").length} tool calls</span>
        </div>
      )}

      {/* Feed content */}
      <div
        ref={scrollRef}
        className={`flex-1 overflow-y-auto px-4 py-3 ${isFullscreen ? "max-w-3xl mx-auto w-full" : ""}`}
        onScroll={(e) => {
          const el = e.currentTarget;
          const atBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 50;
          if (atBottom !== autoScroll) setAutoScroll(atBottom);
        }}
      >
        {feedItems.length === 0 ? (
          <div className="flex h-full items-center justify-center text-xs text-[var(--text-secondary)]">
            Waiting for activity...
          </div>
        ) : (
          feedItems.map((item, i) => (
            <FeedItemRow key={item.id} item={item} isLast={i === feedItems.length - 1} />
          ))
        )}
      </div>

      {/* Scroll-to-bottom button */}
      {!autoScroll && feedItems.length > 5 && (
        <div className="absolute bottom-16 left-1/2 -translate-x-1/2">
          <button
            onClick={() => {
              setAutoScroll(true);
              scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
            }}
            className="flex items-center gap-1.5 rounded-full border border-[var(--border)] bg-[var(--bg-card)] px-3 py-1.5 text-[10px] text-[var(--text-secondary)] shadow-lg transition-colors hover:border-[var(--accent-purple)] hover:text-[var(--text-primary)]"
          >
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            Jump to latest
          </button>
        </div>
      )}
    </div>
  );
}
