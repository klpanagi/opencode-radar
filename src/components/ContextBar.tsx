"use client";

import { useState } from "react";
import type { CompactionEvent, ContextSnapshot } from "@/lib/types";
import { Modal } from "./Modal";

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

export function ContextBar({
  snapshots,
  compactions,
  contextLimit,
}: {
  snapshots: ContextSnapshot[];
  compactions: CompactionEvent[];
  contextLimit: number;
}) {
  const [showDetail, setShowDetail] = useState(false);

  if (snapshots.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-secondary)] text-xs">
        No context data yet
      </div>
    );
  }

  const latest = snapshots[snapshots.length - 1];
  const currentPct = (latest.inputTokens / contextLimit) * 100;
  const peak = Math.max(...snapshots.map((s) => s.inputTokens));
  const peakPct = (peak / contextLimit) * 100;

  const barColor =
    currentPct >= 90
      ? "var(--accent-red)"
      : currentPct >= 70
        ? "var(--accent-orange)"
        : currentPct >= 50
          ? "var(--accent-yellow)"
          : "var(--accent-green)";

  return (
    <div className="space-y-3">
      {/* Main bar */}
      <div
        className="cursor-pointer rounded-lg bg-[var(--bg-secondary)] p-3 transition-colors hover:bg-[var(--bg-card-hover)]"
        onClick={() => setShowDetail(true)}
      >
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium text-[var(--text-primary)]">Context Window</span>
            {compactions.length > 0 && (
              <span className="rounded bg-[var(--accent-purple)]20 px-1.5 py-0.5 text-[9px] font-medium text-[var(--accent-purple)]">
                {compactions.length} compaction{compactions.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>
          <span className="text-xs text-[var(--text-secondary)]">
            {formatTokens(latest.inputTokens)} / {formatTokens(contextLimit)}
          </span>
        </div>

        {/* Progress bar with compaction markers */}
        <div className="relative h-2.5 w-full overflow-hidden rounded-full bg-[var(--bg-primary)]">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(currentPct, 100)}%`, backgroundColor: barColor }}
          />
          {compactions.map((c, i) => {
            const pos = compactions.length > 1 ? (i / (compactions.length - 1)) * 90 + 5 : 50;
            return (
              <div
                key={i}
                className="absolute top-0 h-full w-0.5 bg-[var(--accent-purple)]"
                style={{ left: `${pos}%` }}
                title={`Compaction #${i + 1} (${c.auto ? "auto" : "manual"})`}
              />
            );
          })}
        </div>

        <div className="mt-2 flex items-center justify-between text-[10px]">
          <span style={{ color: barColor }} className="font-semibold">
            {currentPct.toFixed(0)}% used
          </span>
          {currentPct >= 80 && compactions.length === 0 && (
            <span className="text-[var(--accent-orange)]">
              Compaction likely soon
            </span>
          )}
          {compactions.length > 0 && (
            <span className="text-[var(--text-secondary)]">
              Peak: {formatTokens(peak)} ({peakPct.toFixed(0)}%)
            </span>
          )}
        </div>
      </div>

      {/* Detail Modal */}
      <Modal
        open={showDetail}
        onClose={() => setShowDetail(false)}
        title="Context Window Details"
      >
        <div className="space-y-5">
          {/* Current state */}
          <div className="grid grid-cols-3 gap-3">
            <div className="rounded-lg bg-[var(--bg-secondary)] p-3">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-0.5">Current</div>
              <div className="text-lg font-bold" style={{ color: barColor }}>
                {formatTokens(latest.inputTokens)}
              </div>
              <div className="text-[9px] text-[var(--text-secondary)]">{currentPct.toFixed(1)}% of limit</div>
            </div>
            <div className="rounded-lg bg-[var(--bg-secondary)] p-3">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-0.5">Peak</div>
              <div className="text-lg font-bold text-[var(--accent-orange)]">
                {formatTokens(peak)}
              </div>
              <div className="text-[9px] text-[var(--text-secondary)]">{peakPct.toFixed(1)}% of limit</div>
            </div>
            <div className="rounded-lg bg-[var(--bg-secondary)] p-3">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-0.5">Limit</div>
              <div className="text-lg font-bold text-[var(--text-primary)]">
                {formatTokens(contextLimit)}
              </div>
              <div className="text-[9px] text-[var(--text-secondary)]">max context window</div>
            </div>
          </div>

          {/* Compaction history */}
          <div>
            <div className="text-xs font-semibold mb-3 text-[var(--text-secondary)]">
              Compaction History ({compactions.length})
            </div>
            {compactions.length === 0 ? (
              <div className="rounded-lg bg-[var(--bg-secondary)] p-4 text-xs text-[var(--text-secondary)]">
                No compactions have occurred in this session.
                {currentPct >= 70 && (
                  <span className="text-[var(--accent-orange)]">
                    {" "}Context is getting large — compaction may happen soon.
                  </span>
                )}
              </div>
            ) : (
              <div className="space-y-2 max-h-[300px] overflow-y-auto pr-1">
                {compactions.map((c, i) => {
                  return (
                    <div
                      key={i}
                      className="rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] p-4"
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-[var(--accent-purple)]" />
                          <span className="text-xs font-semibold text-[var(--accent-purple)]">
                            Compaction #{i + 1}
                          </span>
                          <span className="rounded bg-[var(--bg-primary)] px-1.5 py-0.5 text-[9px] text-[var(--text-secondary)]">
                            {c.auto ? "auto" : "manual"}
                          </span>
                        </div>
                        <span className="text-[10px] text-[var(--text-secondary)]">
                          {formatFullTime(c.timestamp)}
                        </span>
                      </div>
                      <div className="mt-1.5 text-[10px] text-[var(--text-secondary)]">
                        After turn #{c.turnIndex}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Context over time mini chart */}
          <div>
            <div className="text-xs font-semibold mb-3 text-[var(--text-secondary)]">
              Context Usage Over Time
            </div>
            <div className="rounded-lg bg-[var(--bg-secondary)] p-4">
              <ContextMiniChart
                snapshots={snapshots}
                compactions={compactions}
                contextLimit={contextLimit}
              />
            </div>
          </div>
        </div>
      </Modal>
    </div>
  );
}

function ContextMiniChart({
  snapshots,
  compactions,
  contextLimit,
}: {
  snapshots: ContextSnapshot[];
  compactions: CompactionEvent[];
  contextLimit: number;
}) {
  if (snapshots.length < 2) {
    return (
      <div className="text-xs text-[var(--text-secondary)] text-center py-4">
        Not enough data points for a chart
      </div>
    );
  }

  const width = 100;
  const height = 40;
  const maxTokens = Math.max(contextLimit, ...snapshots.map((s) => s.inputTokens));

  // Build SVG path
  const points = snapshots.map((s, i) => {
    const x = (i / (snapshots.length - 1)) * width;
    const y = height - (s.inputTokens / maxTokens) * height;
    return `${x},${y}`;
  });
  const pathD = `M${points.join(" L")}`;

  // Limit line
  const limitY = height - (contextLimit / maxTokens) * height;

  // Compaction X positions
  const compactionXs = compactions.map((c) => {
    const cTime = new Date(c.timestamp).getTime();
    const startTime = new Date(snapshots[0].timestamp).getTime();
    const endTime = new Date(snapshots[snapshots.length - 1].timestamp).getTime();
    const range = endTime - startTime || 1;
    return ((cTime - startTime) / range) * width;
  });

  return (
    <svg viewBox={`0 0 ${width} ${height + 4}`} className="w-full h-24" preserveAspectRatio="none">
      {/* Limit line */}
      <line
        x1="0"
        y1={limitY}
        x2={width}
        y2={limitY}
        stroke="var(--accent-red)"
        strokeWidth="0.3"
        strokeDasharray="2,2"
        opacity="0.5"
      />
      {/* Context usage line */}
      <path
        d={pathD}
        fill="none"
        stroke="var(--accent-blue)"
        strokeWidth="0.8"
      />
      {/* Fill under the line */}
      <path
        d={`${pathD} L${width},${height} L0,${height} Z`}
        fill="var(--accent-blue)"
        opacity="0.1"
      />
      {/* Compaction markers */}
      {compactionXs.map((x, i) => (
        <line
          key={i}
          x1={x}
          y1="0"
          x2={x}
          y2={height}
          stroke="var(--accent-purple)"
          strokeWidth="0.5"
          strokeDasharray="1,1"
        />
      ))}
    </svg>
  );
}
