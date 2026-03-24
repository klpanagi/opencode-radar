"use client";

import { useEffect, useState, useRef } from "react";

interface WorkPatternCell {
  day: number;
  hour: number;
  cost: number;
  sessions: number;
  tokens: number;
}

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

function formatHour(h: number): string {
  if (h === 0) return "12am";
  if (h === 12) return "12pm";
  return h < 12 ? `${h}am` : `${h - 12}pm`;
}

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

interface TooltipState {
  cell: WorkPatternCell;
  x: number;
  y: number;
}

export function WorkPatternHeatmap() {
  const [data, setData] = useState<WorkPatternCell[]>([]);
  const [period, setPeriod] = useState<30 | 90>(90);
  const [loading, setLoading] = useState(true);
  const [metric, setMetric] = useState<"cost" | "sessions">("cost");
  const [tooltip, setTooltip] = useState<TooltipState | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/work-pattern?days=${period}`)
      .then((r) => r.json())
      .then((d: WorkPatternCell[]) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [period]);

  // Build 7×24 grid indexed by [day][hour]
  const grid: (WorkPatternCell | null)[][] = Array.from({ length: 7 }, () =>
    Array(24).fill(null)
  );
  for (const cell of data) {
    grid[cell.day][cell.hour] = cell;
  }

  const maxValue = Math.max(
    ...data.map((c) => (metric === "cost" ? c.cost : c.sessions)),
    0.001
  );

  function getOpacity(cell: WorkPatternCell | null): number {
    if (!cell) return 0;
    const value = metric === "cost" ? cell.cost : cell.sessions;
    if (value === 0) return 0;
    return 0.12 + (value / maxValue) * 0.88;
  }

  const handleMouseEnter = (cell: WorkPatternCell | null, e: React.MouseEvent) => {
    if (cell) setTooltip({ cell, x: e.clientX, y: e.clientY });
  };
  const handleMouseMove = (cell: WorkPatternCell | null, e: React.MouseEvent) => {
    if (cell) setTooltip({ cell, x: e.clientX, y: e.clientY });
  };
  const handleMouseLeave = () => setTooltip(null);

  return (
    <div ref={containerRef}>
      {/* Header row */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">
            Work Pattern
          </div>
          <div className="mt-0.5 text-[10px] text-[var(--text-secondary)]">
            Activity by day &amp; hour
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* Metric toggle */}
          <div className="flex rounded-lg bg-[var(--bg-secondary)] p-0.5">
            {(["cost", "sessions"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMetric(m)}
                className={`rounded-md px-3 py-1 text-[10px] font-medium capitalize transition-colors ${
                  metric === m
                    ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {m}
              </button>
            ))}
          </div>
          {/* Period toggle */}
          <div className="flex rounded-lg bg-[var(--bg-secondary)] p-0.5">
            {([30, 90] as const).map((p) => (
              <button
                key={p}
                onClick={() => setPeriod(p)}
                className={`rounded-md px-3 py-1 text-[10px] font-medium transition-colors ${
                  period === p
                    ? "bg-[var(--bg-card)] text-[var(--text-primary)]"
                    : "text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                }`}
              >
                {p}d
              </button>
            ))}
          </div>
        </div>
      </div>

      {loading ? (
        <div className="flex h-40 items-center justify-center">
          <div className="h-5 w-5 animate-spin-slow rounded-full border-2 border-[var(--accent-purple)] border-t-transparent" />
        </div>
      ) : data.length === 0 ? (
        <div className="flex h-40 items-center justify-center text-xs text-[var(--text-secondary)]">
          No data for this period
        </div>
      ) : (
        <>
          {/* Grid */}
          <div className="overflow-x-auto">
            <div className="flex gap-1.5 items-start" style={{ minWidth: "fit-content" }}>
              {/* Day labels */}
              <div className="flex flex-col shrink-0 pt-5">
                {DAYS.map((day) => (
                  <div
                    key={day}
                    className="flex items-center justify-end pr-2 text-[9px] text-[var(--text-secondary)]"
                    style={{ height: "18px", marginBottom: "3px" }}
                  >
                    {day}
                  </div>
                ))}
              </div>

              {/* Cells + hour labels */}
              <div className="flex flex-col gap-0">
                {/* Hour labels */}
                <div className="flex mb-1" style={{ gap: "3px" }}>
                  {Array.from({ length: 24 }, (_, h) => (
                    <div
                      key={h}
                      className="text-center text-[8px] text-[var(--text-secondary)]"
                      style={{ width: "18px" }}
                    >
                      {h % 6 === 0 ? formatHour(h) : ""}
                    </div>
                  ))}
                </div>

                {/* Day rows */}
                {DAYS.map((_, dayIdx) => (
                  <div key={dayIdx} className="flex" style={{ gap: "3px", marginBottom: "3px" }}>
                    {Array.from({ length: 24 }, (_, hour) => {
                      const cell = grid[dayIdx][hour];
                      const opacity = getOpacity(cell);
                      return (
                        <div
                          key={hour}
                          className="rounded-sm cursor-default transition-transform hover:scale-125"
                          style={{
                            width: "18px",
                            height: "18px",
                            backgroundColor:
                              opacity > 0
                                ? `rgba(168, 85, 247, ${opacity})`
                                : "var(--bg-secondary)",
                            border: "1px solid var(--border)",
                          }}
                          onMouseEnter={(e) => handleMouseEnter(cell, e)}
                          onMouseMove={(e) => handleMouseMove(cell, e)}
                          onMouseLeave={handleMouseLeave}
                        />
                      );
                    })}
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-1.5 mt-3 justify-end">
            <span className="text-[9px] text-[var(--text-secondary)]">Less</span>
            {[0.12, 0.34, 0.56, 0.78, 1.0].map((o) => (
              <div
                key={o}
                className="rounded-sm"
                style={{
                  width: "12px",
                  height: "12px",
                  backgroundColor: `rgba(168, 85, 247, ${o})`,
                }}
              />
            ))}
            <span className="text-[9px] text-[var(--text-secondary)]">More</span>
          </div>
        </>
      )}

      {/* Tooltip — rendered at cursor position via fixed positioning */}
      {tooltip && (
        <div
          className="fixed z-50 pointer-events-none rounded-lg bg-[var(--bg-primary)] border border-[var(--border)] px-3 py-2 shadow-lg"
          style={{ left: tooltip.x + 14, top: tooltip.y - 14 }}
        >
          <div className="text-[10px] font-medium text-[var(--text-primary)] mb-1">
            {DAYS[tooltip.cell.day]}{" "}
            {formatHour(tooltip.cell.hour)}
            {" – "}
            {formatHour((tooltip.cell.hour + 1) % 24)}
          </div>
          <div className="space-y-0.5 text-[10px] text-[var(--text-secondary)]">
            <div>
              Cost:{" "}
              <span className="text-[var(--accent-green)]">
                {formatCost(tooltip.cell.cost)}
              </span>
            </div>
            <div>
              Sessions:{" "}
              <span className="text-[var(--text-primary)]">
                {tooltip.cell.sessions}
              </span>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
