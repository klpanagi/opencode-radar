"use client";

import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

interface CostPoint {
  timestamp: string;
  cumulativeCost: number;
  model: string;
}

function formatTime(ts: string): string {
  const d = new Date(ts);
  return d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function getVar(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

export function CostChart({ data }: { data: CostPoint[] }) {
  if (data.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-[var(--text-secondary)]">
        No cost data yet
      </div>
    );
  }

  const chartData = data.map((d) => ({
    time: formatTime(d.timestamp),
    cost: d.cumulativeCost,
    rawTime: d.timestamp,
  }));

  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={chartData} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
        <defs>
          <linearGradient id="costGrad" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#4ade80" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#4ade80" stopOpacity={0} />
          </linearGradient>
        </defs>
        <XAxis
          dataKey="time"
          tick={{ fill: getVar("--chart-axis") || "#8888a4", fontSize: 10 }}
          axisLine={{ stroke: getVar("--chart-grid") || "#2a2a3e" }}
          tickLine={false}
        />
        <YAxis
          tick={{ fill: getVar("--chart-axis") || "#8888a4", fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${v.toFixed(2)}`}
          width={55}
        />
        <Tooltip
          contentStyle={{
            background: getVar("--chart-tooltip-bg") || "#1a1a2e",
            border: `1px solid ${getVar("--chart-tooltip-border") || "#2a2a3e"}`,
            borderRadius: 8,
            fontSize: 12,
            color: getVar("--text-primary") || "#e4e4ef",
          }}
          formatter={(value: number) => [`$${value.toFixed(4)}`, "Cost"]}
          labelFormatter={(label: string) => label}
        />
        <Area
          type="stepAfter"
          dataKey="cost"
          stroke="#4ade80"
          strokeWidth={2}
          fill="url(#costGrad)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
