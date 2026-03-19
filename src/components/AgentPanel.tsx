"use client";

import { useState } from "react";
import type { AgentInfo } from "@/lib/types";
import { Modal } from "./Modal";

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

function formatTime(ts: string): string {
  return new Date(ts).toLocaleTimeString([], {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function formatFullTime(ts: string): string {
  return new Date(ts).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

function getModelName(model?: string): string {
  if (!model) return "Unknown";
  if (model.includes("opus")) return "Opus";
  if (model.includes("sonnet")) return "Sonnet";
  if (model.includes("haiku")) return "Haiku";
  return model;
}

function formatDuration(start?: string, end?: string): string {
  if (!start || !end) return "N/A";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  if (ms < 60000) return `${(ms / 1000).toFixed(1)}s`;
  return `${(ms / 60000).toFixed(1)}m`;
}

function StatusBadge({ status }: { status: AgentInfo["status"] }) {
  const styles = {
    running: {
      bg: "bg-[#4ade8020]",
      text: "text-[#4ade80]",
      dot: "bg-[#4ade80] animate-pulse-slow",
      label: "Running",
    },
    completed: {
      bg: "bg-[#f472b620]",
      text: "text-[#f472b6]",
      dot: "bg-[#f472b6]",
      label: "Completed",
    },
    unknown: {
      bg: "bg-[#8888a420]",
      text: "text-[#8888a4]",
      dot: "bg-[#8888a4]",
      label: "Unknown",
    },
  };

  const s = styles[status];

  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${s.bg} ${s.text}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${s.dot}`} />
      {s.label}
    </span>
  );
}

export function AgentPanel({ agents }: { agents: AgentInfo[] }) {
  const [selectedAgent, setSelectedAgent] = useState<AgentInfo | null>(null);

  if (agents.length === 0) {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-2 text-[var(--text-secondary)]">
        <svg className="h-8 w-8 opacity-40" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span className="text-xs">No agents spawned</span>
      </div>
    );
  }

  const running = agents.filter((a) => a.status === "running");
  const completed = agents.filter((a) => a.status !== "running");
  const totalAgentCost = agents.reduce((sum, a) => sum + a.totalCost, 0);

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="flex items-center justify-between rounded-lg bg-[var(--bg-secondary)] px-4 py-2.5">
        <div className="flex items-center gap-4">
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Total</div>
            <div className="text-lg font-bold">{agents.length}</div>
          </div>
          {running.length > 0 && (
            <div>
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Active</div>
              <div className="text-lg font-bold text-[var(--accent-green)]">{running.length}</div>
            </div>
          )}
        </div>
        <div className="text-right">
          <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Agent Cost</div>
          <div className="text-lg font-bold text-[var(--accent-orange)]">{formatCost(totalAgentCost)}</div>
        </div>
      </div>

      {/* Agent list */}
      <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
        {[...running, ...completed].map((agent) => (
          <div
            key={agent.id}
            className="cursor-pointer rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-3 transition-colors hover:bg-[var(--bg-card-hover)]"
            onClick={() => setSelectedAgent(agent)}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <StatusBadge status={agent.status} />
                  <span className="text-[10px] font-mono text-[var(--text-secondary)]">
                    {agent.id.slice(0, 12)}...
                  </span>
                </div>
                {agent.description && (
                  <p className="mt-1.5 truncate text-xs text-[var(--text-primary)]">
                    {agent.description}
                  </p>
                )}
              </div>
              <div className="shrink-0 text-right">
                <div className="text-sm font-semibold text-[var(--accent-green)]">
                  {formatCost(agent.totalCost)}
                </div>
              </div>
            </div>

            <div className="mt-2 flex items-center gap-3 text-[10px] text-[var(--text-secondary)]">
              <span className="rounded bg-[var(--bg-primary)] px-1.5 py-0.5">{getModelName(agent.model)}</span>
              <span>{formatTokens(agent.totalTokens.inputTokens + agent.totalTokens.outputTokens)} tokens</span>
              <span>{agent.messageCount} messages</span>
              {agent.startTime && <span>{formatTime(agent.startTime)}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* Agent Detail Modal */}
      <Modal
        open={selectedAgent !== null}
        onClose={() => setSelectedAgent(null)}
        title="Agent Details"
      >
        {selectedAgent && (
          <div className="space-y-5">
            {/* Header */}
            <div className="rounded-lg bg-[var(--bg-secondary)] p-4">
              <div className="flex items-center gap-3 mb-3">
                <StatusBadge status={selectedAgent.status} />
                <span className="font-mono text-xs text-[var(--text-secondary)]">{selectedAgent.id}</span>
              </div>
              {selectedAgent.description && (
                <div className="max-h-[200px] overflow-y-auto rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] p-3 text-sm text-[var(--text-primary)] whitespace-pre-wrap">
                  {selectedAgent.description}
                </div>
              )}
            </div>

            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard label="Cost" value={formatCost(selectedAgent.totalCost)} color="var(--accent-green)" />
              <StatCard label="Model" value={getModelName(selectedAgent.model)} color="var(--accent-purple)" />
              <StatCard label="Messages" value={selectedAgent.messageCount.toString()} color="var(--accent-blue)" />
              <StatCard
                label="Duration"
                value={formatDuration(selectedAgent.startTime, selectedAgent.lastActivity)}
                color="var(--accent-orange)"
              />
            </div>

            {/* Token breakdown */}
            <div>
              <div className="text-xs font-semibold mb-3 text-[var(--text-secondary)]">Token Usage</div>
              <div className="grid grid-cols-2 gap-3">
                <TokenDetail label="Input Tokens" value={selectedAgent.totalTokens.inputTokens} color="#60a5fa" />
                <TokenDetail label="Output Tokens" value={selectedAgent.totalTokens.outputTokens} color="#a78bfa" />
                <TokenDetail label="Cache Write" value={selectedAgent.totalTokens.cacheCreationTokens} color="#fb923c" />
                <TokenDetail label="Cache Read" value={selectedAgent.totalTokens.cacheReadTokens} color="#fbbf24" />
              </div>
            </div>

            {/* Timing */}
            <div className="rounded-lg bg-[var(--bg-secondary)] p-4">
              <div className="text-xs font-semibold mb-2 text-[var(--text-secondary)]">Timing</div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-0.5">Started</div>
                  <div>{selectedAgent.startTime ? formatFullTime(selectedAgent.startTime) : "N/A"}</div>
                </div>
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-0.5">Last Activity</div>
                  <div>{selectedAgent.lastActivity ? formatFullTime(selectedAgent.lastActivity) : "N/A"}</div>
                </div>
              </div>
            </div>

            {/* Efficiency note */}
            <div className="rounded-lg bg-[var(--bg-secondary)] p-4">
              <div className="text-xs font-semibold mb-2 text-[var(--text-secondary)]">Efficiency</div>
              <div className="text-xs text-[var(--text-primary)]">
                {selectedAgent.totalTokens.cacheReadTokens > selectedAgent.totalTokens.cacheCreationTokens * 2
                  ? "Good cache utilization — this agent reused cached context efficiently."
                  : selectedAgent.totalTokens.cacheReadTokens > 0
                    ? "Moderate cache usage. Some context was reused."
                    : "No cache hits — this agent processed all context from scratch."}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}

function StatCard({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div className="rounded-lg bg-[var(--bg-secondary)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-0.5">{label}</div>
      <div className="text-lg font-bold" style={{ color }}>{value}</div>
    </div>
  );
}

function TokenDetail({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="rounded-lg bg-[var(--bg-secondary)] px-3 py-2">
      <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-0.5">{label}</div>
      <div className="text-sm font-semibold" style={{ color }}>{formatTokens(value)}</div>
    </div>
  );
}
