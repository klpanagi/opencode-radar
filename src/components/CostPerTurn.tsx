"use client";

import { useState } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import type { CostPerTurn as CostPerTurnType } from "@/lib/types";
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

function getCostColor(cost: number, maxCost: number): string {
  const ratio = cost / (maxCost || 1);
  if (ratio > 0.7) return "#f87171";
  if (ratio > 0.4) return "#fb923c";
  if (ratio > 0.2) return "#fbbf24";
  return "#4ade80";
}

interface TooltipPayload {
  payload?: CostPerTurnType & { label: string };
}

function CustomTooltip({ active, payload }: { active?: boolean; payload?: TooltipPayload[] }) {
  if (!active || !payload?.[0]?.payload) return null;
  const data = payload[0].payload;

  return (
    <div className="rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] px-3 py-2 shadow-lg max-w-xs">
      <div className="text-xs text-[var(--text-primary)] mb-1 truncate">
        &ldquo;{data.userContent}&rdquo;
      </div>
      <div className="flex items-center gap-3 text-[10px]">
        <span className="text-[var(--accent-green)] font-semibold">{formatCost(data.cost)}</span>
        <span className="text-[var(--text-secondary)]">{data.assistantMessages} responses</span>
        <span className="text-[var(--text-secondary)]">{data.toolCalls.length} tools</span>
      </div>
      <div className="mt-1 text-[9px] text-[var(--text-secondary)]">Click bar for details</div>
    </div>
  );
}

function getVar(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function CostPerTurnChart({ turns }: { turns: CostPerTurnType[] }) {
  const [selectedTurn, setSelectedTurn] = useState<CostPerTurnType | null>(null);

  if (turns.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-secondary)] text-xs">
        No turn data
      </div>
    );
  }

  const maxCost = Math.max(...turns.map((t) => t.cost));
  const totalCost = turns.reduce((sum, t) => sum + t.cost, 0);
  const avgCost = totalCost / turns.length;
  const mostExpensive = turns.reduce((a, b) => (a.cost > b.cost ? a : b));

  const chartData = turns.map((t) => ({
    ...t,
    label: `Turn ${t.turnIndex + 1}`,
  }));

  // Count tool usage across all turns
  const allToolCalls = turns.flatMap((t) => t.toolCalls);
  const toolCounts = allToolCalls.reduce((acc, t) => {
    acc[t] = (acc[t] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="space-y-3">
      {/* Summary */}
      <div className="flex items-center gap-6 text-[10px]">
        <div>
          <span className="text-[var(--text-secondary)]">Avg per turn: </span>
          <span className="font-semibold text-[var(--accent-blue)]">{formatCost(avgCost)}</span>
        </div>
        <div>
          <span className="text-[var(--text-secondary)]">Most expensive: </span>
          <span className="font-semibold text-[var(--accent-red)]">{formatCost(maxCost)}</span>
        </div>
        <div>
          <span className="text-[var(--text-secondary)]">Turns: </span>
          <span className="font-semibold">{turns.length}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-44">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={chartData}
            margin={{ top: 5, right: 5, left: 5, bottom: 5 }}
            onClick={(e) => {
              if (e?.activePayload?.[0]?.payload) {
                setSelectedTurn(e.activePayload[0].payload);
              }
            }}
            style={{ cursor: "pointer" }}
          >
            <XAxis
              dataKey="label"
              tick={{ fill: getVar("--chart-axis") || "#8888a4", fontSize: 9 }}
              axisLine={{ stroke: getVar("--chart-grid") || "#2a2a3e" }}
              tickLine={false}
              interval={Math.max(0, Math.floor(turns.length / 10) - 1)}
            />
            <YAxis
              tick={{ fill: getVar("--chart-axis") || "#8888a4", fontSize: 9 }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `$${v.toFixed(2)}`}
              width={45}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: getVar("--chart-cursor") || "rgba(255,255,255,0.05)" }} />
            <Bar dataKey="cost" radius={[3, 3, 0, 0]} maxBarSize={24}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={getCostColor(entry.cost, maxCost)} fillOpacity={0.8} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Turn Detail Modal */}
      <Modal
        open={selectedTurn !== null}
        onClose={() => setSelectedTurn(null)}
        title={`Turn ${(selectedTurn?.turnIndex ?? 0) + 1} Details`}
      >
        {selectedTurn && (
          <div className="space-y-5">
            {/* User message */}
            <div className="rounded-lg bg-[var(--bg-secondary)] p-4">
              <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-2">Your Message</div>
              <div className="max-h-[200px] overflow-y-auto rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] p-3 text-sm text-[var(--text-primary)] whitespace-pre-wrap">
                {selectedTurn.userContent}
              </div>
              <div className="mt-2 text-[10px] text-[var(--text-secondary)]">
                {new Date(selectedTurn.userTimestamp).toLocaleString()}
              </div>
            </div>

            {/* Cost & token stats */}
            <div className="grid grid-cols-3 gap-3">
              <div className="rounded-lg bg-[var(--bg-secondary)] p-3">
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-0.5">Cost</div>
                <div className="text-xl font-bold text-[var(--accent-green)]">{formatCost(selectedTurn.cost)}</div>
                <div className="text-[9px] text-[var(--text-secondary)] mt-0.5">
                  {totalCost > 0 ? `${((selectedTurn.cost / totalCost) * 100).toFixed(1)}% of session` : ""}
                </div>
              </div>
              <div className="rounded-lg bg-[var(--bg-secondary)] p-3">
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-0.5">Tokens</div>
                <div className="text-xl font-bold text-[var(--accent-blue)]">{formatTokens(selectedTurn.tokens)}</div>
                <div className="text-[9px] text-[var(--text-secondary)] mt-0.5">input + output</div>
              </div>
              <div className="rounded-lg bg-[var(--bg-secondary)] p-3">
                <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)] mb-0.5">Responses</div>
                <div className="text-xl font-bold text-[var(--accent-purple)]">{selectedTurn.assistantMessages}</div>
                <div className="text-[9px] text-[var(--text-secondary)] mt-0.5">assistant messages</div>
              </div>
            </div>

            {/* Tool calls for this turn */}
            {selectedTurn.toolCalls.length > 0 && (
              <div>
                <div className="text-xs font-semibold mb-2 text-[var(--text-secondary)]">
                  Tool Calls ({selectedTurn.toolCalls.length})
                </div>
                <div className="flex flex-wrap gap-2">
                  {selectedTurn.toolCalls.map((tool, i) => (
                    <span
                      key={i}
                      className="rounded-lg bg-[var(--bg-secondary)] px-2.5 py-1 text-[11px] text-[var(--accent-orange)]"
                    >
                      {tool}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Comparison to average */}
            <div className="rounded-lg bg-[var(--bg-secondary)] p-4">
              <div className="text-xs font-semibold mb-2 text-[var(--text-secondary)]">Compared to Average</div>
              <div className="text-xs text-[var(--text-primary)]">
                {selectedTurn.cost > avgCost * 2 ? (
                  <span>
                    This turn cost <span className="font-semibold text-[#f87171]">{(selectedTurn.cost / avgCost).toFixed(1)}x</span> the average turn.
                    {selectedTurn.toolCalls.length > 3
                      ? " Heavy tool usage drove up the cost."
                      : selectedTurn.assistantMessages > 3
                        ? " Multiple response rounds increased the cost."
                        : " The prompt likely required extensive reasoning."}
                  </span>
                ) : selectedTurn.cost > avgCost ? (
                  <span>
                    Slightly above average (<span className="font-semibold text-[#fbbf24]">{(selectedTurn.cost / avgCost).toFixed(1)}x</span>).
                  </span>
                ) : (
                  <span>
                    Below average cost (<span className="font-semibold text-[#4ade80]">{(selectedTurn.cost / avgCost).toFixed(1)}x</span>). Efficient turn.
                  </span>
                )}
              </div>
            </div>

            {/* Is this the most expensive? */}
            {selectedTurn.turnIndex === mostExpensive.turnIndex && (
              <div className="rounded-lg border border-[#f8717130] bg-[#f8717108] p-4">
                <div className="flex items-center gap-2 text-xs text-[#f87171] font-semibold">
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  This is the most expensive turn in the session
                </div>
              </div>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
