"use client";

import type { ModelBreakdown as ModelBreakdownType } from "@/lib/types";

const MODEL_COLORS: Record<string, string> = {
  Opus: "#a78bfa",
  Sonnet: "#60a5fa",
  Haiku: "#4ade80",
};

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

export function ModelBreakdown({
  breakdown,
}: {
  breakdown: Record<string, ModelBreakdownType>;
}) {
  const models = Object.entries(breakdown).sort((a, b) => b[1].cost - a[1].cost);
  const totalCost = models.reduce((sum, [, m]) => sum + m.cost, 0);

  if (models.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-secondary)]">
        No model data
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {models.map(([name, data]) => {
        const pct = totalCost > 0 ? (data.cost / totalCost) * 100 : 0;
        const color = MODEL_COLORS[name] || "#8888a4";

        return (
          <div key={name}>
            <div className="mb-1.5 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: color }}
                />
                <span className="text-sm font-medium">{name}</span>
              </div>
              <div className="flex items-center gap-3">
                <span className="text-xs text-[var(--text-secondary)]">
                  {data.count} calls
                </span>
                <span className="text-sm font-semibold" style={{ color }}>
                  {formatCost(data.cost)}
                </span>
              </div>
            </div>
            <div className="h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-secondary)]">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{ width: `${pct}%`, backgroundColor: color }}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
