"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { CostPerTurn as CostPerTurnType, MessageInfo, SessionData, TimelineEvent } from "@/lib/types";

export function formatTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}

export function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

export function formatDuration(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) ms = 0;
  const totalSec = Math.round(ms / 1000);
  if (totalSec < 60) return `${totalSec}s`;
  const totalMin = Math.floor(totalSec / 60);
  if (totalMin < 60) return `${totalMin}m ${totalSec % 60}s`;
  const totalHours = Math.floor(totalMin / 60);
  if (totalHours < 24) return `${totalHours}h ${totalMin % 60}m`;
  const totalDays = Math.floor(totalHours / 24);
  return `${totalDays}d ${totalHours % 24}h`;
}

function getVar(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

interface Colors {
  green: string;
  blue: string;
  purple: string;
  orange: string;
  red: string;
  yellow: string;
  axis: string;
  grid: string;
  cursor: string;
}

function resolveColors(): Colors {
  return {
    green: getVar("--accent-green") || "#4ade80",
    blue: getVar("--accent-blue") || "#60a5fa",
    purple: getVar("--accent-purple") || "#a78bfa",
    orange: getVar("--accent-orange") || "#fb923c",
    red: getVar("--accent-red") || "#f87171",
    yellow: getVar("--accent-yellow") || "#fbbf24",
    axis: getVar("--chart-axis") || "#8888a4",
    grid: getVar("--chart-grid") || "#2a2a3e",
    cursor: getVar("--chart-cursor") || "rgba(255,255,255,0.05)",
  };
}

function useChartColors(): Colors {
  const [colors, setColors] = useState<Colors>(() => resolveColors());
  useEffect(() => {
    setColors(resolveColors());
    const observer = new MutationObserver(() => setColors(resolveColors()));
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => observer.disconnect();
  }, []);
  return colors;
}

function num(v: unknown, fallback = 0): number {
  return typeof v === "number" && Number.isFinite(v) ? v : fallback;
}

function str(v: unknown, fallback = ""): string {
  return typeof v === "string" ? v : fallback;
}

function formatClock(ms: number): string {
  if (!Number.isFinite(ms)) return "";
  return new Date(ms).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatTime(ts: string): string {
  const ms = new Date(ts).getTime();
  return Number.isFinite(ms) ? formatClock(ms) : "";
}

function quantile(values: number[], q: number): number {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.ceil(sorted.length * q) - 1));
  return sorted[idx];
}

function computeLatencies(messages: MessageInfo[]): LatencyPoint[] {
  const out: LatencyPoint[] = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role !== "user") continue;
    const uMs = new Date(m.timestamp).getTime();
    for (let j = i + 1; j < messages.length; j++) {
      const a = messages[j];
      if (a.role !== "assistant") continue;
      const aMs = new Date(a.timestamp).getTime();
      if (aMs >= uMs) {
        out.push({ t: uMs, label: formatTime(m.timestamp), latencyMs: Math.max(0, aMs - uMs) });
        break;
      }
    }
  }
  return out;
}

function binTimeline(events: TimelineEvent[], startMs: number, endMs: number): DensityPoint[] {
  const wall = endMs - startMs;
  if (events.length === 0 || wall <= 0) return [];
  const bucketMs = wall < 10 * 60000 ? 60000 : 5 * 60000;
  const n = Math.min(120, Math.max(1, Math.ceil(wall / bucketMs)));
  const bins = Array.from({ length: n }, () => ({ count: 0, user: 0, tool: 0, other: 0 }));
  for (const e of events) {
    const t = new Date(e.timestamp).getTime();
    const idx = Math.min(Math.max(Math.floor((t - startMs) / bucketMs), 0), n - 1);
    bins[idx].count++;
    if (e.type === "user") bins[idx].user++;
    else if (e.type === "tool") bins[idx].tool++;
    else bins[idx].other++;
  }
  return bins.map((b, i) => ({
    label: formatClock(startMs + i * bucketMs),
    count: b.count,
    user: b.user,
    tool: b.tool,
    other: b.other,
  }));
}

interface TokenPoint {
  t: number;
  label: string;
  input: number;
  output: number;
  cacheWrite: number;
  cacheRead: number;
  reasoning: number;
}

interface ContextPoint {
  t: number;
  tokens: number;
}

interface TurnPoint extends CostPerTurnType {
  label: string;
  dur: number;
}

interface LatencyPoint {
  t: number;
  label: string;
  latencyMs: number;
}

interface DensityPoint {
  label: string;
  count: number;
  user: number;
  tool: number;
  other: number;
}

interface CostSeriesPoint {
  t: number;
  label: string;
  cost: number;
  model: string;
}

interface CompMarker {
  t: number;
  tokens: number;
  auto: boolean;
}

interface Metrics {
  totalAll: number;
  wallMs: number;
  tokenSeries: TokenPoint[];
  contextSeries: ContextPoint[];
  contextMax: number;
  contextMean: number;
  contextMedian: number;
  contextP95: number;
  currentCtx: number;
  currentPct: number;
  cacheHitRatio: number;
  turnSeries: TurnPoint[];
  avgTurnMs: number;
  latencySeries: LatencyPoint[];
  avgLatencyMs: number;
  density: DensityPoint[];
  tokensPerMin: number;
  turnsPerHour: number;
  toolCallsPerMin: number;
  totalToolCalls: number;
  avgCostPerTurn: number;
  costPer1k: number;
  mostExpensiveTurn: CostPerTurnType | null;
  costSeries: CostSeriesPoint[];
  compMarkers: CompMarker[];
}

function deriveMetrics(session: SessionData): Metrics {
  const startMs = new Date(session.startTime).getTime();
  const endMs = new Date(session.lastActivity).getTime();
  const wallMs = Number.isFinite(endMs - startMs) && endMs - startMs > 0 ? endMs - startMs : 0;

  const tt = session.totalTokens;
  const totalAll = tt.inputTokens + tt.outputTokens + tt.cacheCreationTokens + tt.cacheReadTokens + tt.reasoningTokens;

  const tokenSeries: TokenPoint[] = [];
  for (const msg of session.messages) {
    if (msg.role !== "assistant" || !msg.usage) continue;
    const u = msg.usage;
    tokenSeries.push({
      t: new Date(msg.timestamp).getTime(),
      label: formatTime(msg.timestamp),
      input: u.inputTokens,
      output: u.outputTokens,
      cacheWrite: u.cacheCreationTokens,
      cacheRead: u.cacheReadTokens,
      reasoning: u.reasoningTokens,
    });
  }

  const contextSeries: ContextPoint[] = session.contextSnapshots.map((s) => ({
    t: new Date(s.timestamp).getTime(),
    tokens: s.inputTokens,
  }));
  const ctxValues = contextSeries.map((c) => c.tokens);
  const contextMax = ctxValues.length > 0 ? Math.max(...ctxValues) : 0;
  const contextMean = ctxValues.length > 0 ? ctxValues.reduce((a, b) => a + b, 0) / ctxValues.length : 0;
  const contextMedian = quantile(ctxValues, 0.5);
  const contextP95 = quantile(ctxValues, 0.95);
  const currentCtx = contextSeries.length > 0 ? contextSeries[contextSeries.length - 1].tokens : 0;
  const currentPct = session.contextLimit > 0 ? (currentCtx / session.contextLimit) * 100 : 0;

  const cacheHitRatio =
    tt.cacheReadTokens + tt.inputTokens > 0 ? tt.cacheReadTokens / (tt.cacheReadTokens + tt.inputTokens) : 0;

  const turnSeries: TurnPoint[] = session.costPerTurn.map((t, i) => {
    const cur = new Date(t.userTimestamp).getTime();
    const next = i + 1 < session.costPerTurn.length ? new Date(session.costPerTurn[i + 1].userTimestamp).getTime() : endMs;
    return { ...t, label: `T${t.turnIndex + 1}`, dur: Math.max(0, next - cur) };
  });
  const avgTurnMs = turnSeries.length > 0 ? turnSeries.reduce((a, b) => a + b.dur, 0) / turnSeries.length : 0;

  const latencySeries = computeLatencies(session.messages);
  const avgLatencyMs =
    latencySeries.length > 0 ? latencySeries.reduce((a, b) => a + b.latencyMs, 0) / latencySeries.length : 0;

  const density = binTimeline(session.timeline, startMs, endMs);

  const minutes = wallMs / 60000;
  const tokensPerMin = minutes > 0 ? totalAll / minutes : 0;
  const turnsPerHour = wallMs > 0 ? (session.costPerTurn.length * 3600000) / wallMs : 0;
  const totalToolCalls = session.timeline.filter((e) => e.type === "tool").length;
  const toolCallsPerMin = minutes > 0 ? totalToolCalls / minutes : 0;

  const avgCostPerTurn = session.costPerTurn.length > 0 ? session.totalCost / session.costPerTurn.length : 0;
  const costPer1k = totalAll > 0 ? (session.totalCost / totalAll) * 1000 : 0;
  const mostExpensiveTurn =
    session.costPerTurn.length > 0 ? session.costPerTurn.reduce((a, b) => (b.cost > a.cost ? b : a)) : null;

  const costSeries: CostSeriesPoint[] = session.costOverTime.map((p) => ({
    t: new Date(p.timestamp).getTime(),
    label: formatTime(p.timestamp),
    cost: p.cumulativeCost,
    model: p.model,
  }));

  const compMarkers: CompMarker[] =
    contextSeries.length > 0
      ? session.compactions.map((c) => {
          const cMs = new Date(c.timestamp).getTime();
          const snap = [...contextSeries].reverse().find((s) => s.t <= cMs);
          return { t: cMs, tokens: snap ? snap.tokens : 0, auto: c.auto };
        })
      : [];

  return {
    totalAll,
    wallMs,
    tokenSeries,
    contextSeries,
    contextMax,
    contextMean,
    contextMedian,
    contextP95,
    currentCtx,
    currentPct,
    cacheHitRatio,
    turnSeries,
    avgTurnMs,
    latencySeries,
    avgLatencyMs,
    density,
    tokensPerMin,
    turnsPerHour,
    toolCallsPerMin,
    totalToolCalls,
    avgCostPerTurn,
    costPer1k,
    mostExpensiveTurn,
    costSeries,
    compMarkers,
  };
}

interface TooltipEntry {
  name?: string | number;
  value?: string | number;
  color?: string;
  payload?: Record<string, unknown>;
}

function TooltipShell({
  active,
  payload,
  label,
  formatLabel,
  renderItem,
}: {
  active?: boolean;
  payload?: TooltipEntry[];
  label?: string | number;
  formatLabel?: (label: string | number) => string;
  renderItem?: (entry: TooltipEntry) => ReactNode;
}) {
  if (!active || !payload || payload.length === 0) return null;
  const heading = label != null && label !== "" ? (formatLabel ? formatLabel(label) : String(label)) : "";
  return (
    <div className="rounded-lg border border-[var(--border)] bg-[var(--chart-tooltip-bg)] px-3 py-2 text-[10px] shadow-xl">
      {heading !== "" && <div className="mb-1.5 font-semibold text-[var(--text-primary)]">{heading}</div>}
      <div className="space-y-1">
        {payload.map((entry, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ background: entry.color }} />
            <span className="text-[var(--text-secondary)]">{entry.name}</span>
            <span className="ml-auto pl-3 font-semibold" style={{ color: entry.color }}>
              {renderItem ? renderItem(entry) : String(entry.value)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function turnFromEntry(entry: TooltipEntry): CostPerTurnType | null {
  const d = entry.payload;
  if (!d) return null;
  return {
    turnIndex: num(d.turnIndex, -1),
    userTimestamp: str(d.userTimestamp),
    userContent: str(d.userContent),
    cost: num(d.cost),
    tokens: num(d.tokens),
    assistantMessages: num(d.assistantMessages, 0),
    toolCalls: Array.isArray(d.toolCalls) ? d.toolCalls.filter((t): t is string => typeof t === "string") : [],
  };
}

function TurnTooltip({ active, payload }: { active?: boolean; payload?: TooltipEntry[] }) {
  const entry = active && payload && payload.length > 0 ? payload[0] : null;
  const turn = entry ? turnFromEntry(entry) : null;
  if (!turn) return null;
  const content = turn.userContent.trim();
  return (
    <div className="max-w-[240px] rounded-lg border border-[var(--border)] bg-[var(--chart-tooltip-bg)] px-3 py-2 text-[10px] shadow-xl">
      <div className="truncate text-[var(--text-primary)]">
        &ldquo;{content.length > 60 ? `${content.slice(0, 60)}\u2026` : content}&rdquo;
      </div>
      <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-0.5">
        <span className="font-semibold text-[var(--accent-blue)]">{formatTokens(turn.tokens)} tok</span>
        <span className="font-semibold text-[var(--accent-green)]">{formatCost(turn.cost)}</span>
        <span className="text-[var(--text-secondary)]">{turn.assistantMessages} responses</span>
        <span className="text-[var(--accent-orange)]">{turn.toolCalls.length} tools</span>
      </div>
    </div>
  );
}

function Empty({ text }: { text: string }) {
  return (
    <div className="flex h-full items-center justify-center text-[11px] text-[var(--text-secondary)]">{text}</div>
  );
}

function Section({
  title,
  subtitle,
  accent,
  chips,
  children,
}: {
  title: string;
  subtitle?: string;
  accent: string;
  chips?: { label: string; value: string; color?: string }[];
  children: ReactNode;
}) {
  return (
    <section className="animate-fade-up mt-8">
      <div className="mb-4 flex flex-wrap items-center gap-x-4 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="h-7 w-1.5 rounded-full" style={{ background: accent }} />
          <div>
            <h3 className="text-sm font-bold uppercase tracking-wider" style={{ color: accent }}>
              {title}
            </h3>
            {subtitle && <div className="text-[10px] text-[var(--text-secondary)]">{subtitle}</div>}
          </div>
        </div>
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {chips?.map((c) => (
            <div key={c.label} className="flex items-center gap-1.5 rounded-lg border border-[var(--border)] bg-[var(--bg-card)] px-2 py-1">
              <span className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)]">{c.label}</span>
              <span className="text-[10px] font-semibold" style={{ color: c.color ?? accent }}>
                {c.value}
              </span>
            </div>
          ))}
        </div>
      </div>
      {children}
    </section>
  );
}

function Panel({
  title,
  right,
  className,
  delay = 0,
  children,
}: {
  title: string;
  right?: ReactNode;
  className?: string;
  delay?: number;
  children: ReactNode;
}) {
  return (
    <div
      className={`animate-fade-up rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5 ${className ?? ""}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">{title}</div>
        {right}
      </div>
      {children}
    </div>
  );
}

function Kpi({
  label,
  value,
  accent,
  sub,
  delay = 0,
}: {
  label: string;
  value: string;
  accent: string;
  sub: string;
  delay?: number;
}) {
  return (
    <div
      className="animate-fade-up rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center justify-between">
        <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">{label}</div>
        <span className="h-2.5 w-2.5 rounded-full" style={{ background: accent }} />
      </div>
      <div className="mt-2 text-2xl font-bold tracking-tight" style={{ color: accent }}>
        {value}
      </div>
      <div className="mt-1 text-[10px] text-[var(--text-secondary)]">{sub}</div>
    </div>
  );
}

function ContextKpi({ session, m, colors, delay }: { session: SessionData; m: Metrics; colors: Colors; delay?: number }) {
  const pct = m.currentPct;
  const barColor = pct >= 90 ? colors.red : pct >= 70 ? colors.orange : pct >= 50 ? colors.yellow : colors.green;
  const startMs = new Date(session.startTime).getTime();
  const endMs = new Date(session.lastActivity).getTime();
  const range = endMs - startMs || 1;
  return (
    <div
      className="animate-fade-up col-span-12 rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5"
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <div className="flex items-center gap-3">
          <span className="h-6 w-1 rounded-full" style={{ background: colors.blue }} />
          <div>
            <div className="text-[10px] uppercase tracking-wider text-[var(--text-secondary)]">Context Utilization</div>
            <div className="mt-1 flex items-baseline gap-2">
              <span className="text-2xl font-bold tracking-tight" style={{ color: barColor }}>
                {formatTokens(m.currentCtx)}
              </span>
              <span className="text-[10px] text-[var(--text-secondary)]">
                / {formatTokens(session.contextLimit)} &middot; {pct.toFixed(1)}%
              </span>
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-4 text-[10px] text-[var(--text-secondary)]">
          <span>
            Peak <span className="font-semibold text-[var(--accent-orange)]">{formatTokens(m.contextMax)}</span>
          </span>
          <span>
            Mean <span className="font-semibold text-[var(--accent-yellow)]">{formatTokens(m.contextMean)}</span>
          </span>
          <span>
            Median <span className="font-semibold text-[var(--text-primary)]">{formatTokens(m.contextMedian)}</span>
          </span>
          {session.compactions.length > 0 && (
            <span>
              Compactions{" "}
              <span className="font-semibold text-[var(--accent-purple)]">{session.compactions.length}</span>
            </span>
          )}
        </div>
      </div>
      <div className="relative mt-4 h-3 w-full overflow-hidden rounded-full bg-[var(--bg-secondary)]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${Math.min(pct, 100)}%`, backgroundColor: barColor }}
        />
        {session.compactions.map((c, i) => {
          const pos = Math.min(Math.max(((new Date(c.timestamp).getTime() - startMs) / range) * 100, 0), 100);
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
      <div className="mt-2 flex items-center justify-between text-[9px] text-[var(--text-secondary)]">
        <span>Limit {formatTokens(session.contextLimit)}</span>
        <span className="font-semibold" style={{ color: barColor }}>
          {pct.toFixed(1)}% used
        </span>
      </div>
    </div>
  );
}

function TokenStreamChart({ data, colors }: { data: TokenPoint[]; colors: Colors }) {
  if (data.length === 0) return <Empty text="No token usage recorded" />;
  const series = [
    { key: "input" as const, name: "Input", color: colors.blue },
    { key: "cacheRead" as const, name: "Cache read", color: colors.yellow },
    { key: "cacheWrite" as const, name: "Cache write", color: colors.orange },
    { key: "output" as const, name: "Output", color: colors.purple },
    { key: "reasoning" as const, name: "Reasoning", color: colors.red },
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: colors.axis, fontSize: 10 }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
          minTickGap={50}
        />
        <YAxis
          tick={{ fill: colors.axis, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatTokens(v)}
          width={46}
        />
        <Tooltip
          content={
            <TooltipShell renderItem={(e) => (typeof e.value === "number" ? formatTokens(e.value) : String(e.value))} />
          }
          cursor={{ fill: colors.cursor }}
        />
        {series.map((s) => (
          <Area
            key={s.key}
            type="monotone"
            dataKey={s.key}
            name={s.name}
            stackId="tokens"
            stroke={s.color}
            strokeWidth={1.5}
            fill={s.color}
            fillOpacity={0.28}
            animationDuration={600}
          />
        ))}
      </AreaChart>
    </ResponsiveContainer>
  );
}

function ContextChart({
  series,
  limit,
  mean,
  max,
  compMarkers,
  colors,
}: {
  series: ContextPoint[];
  limit: number;
  mean: number;
  max: number;
  compMarkers: CompMarker[];
  colors: Colors;
}) {
  if (series.length < 2) return <Empty text="Not enough context snapshots" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={series} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="ctxFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.blue} stopOpacity={0.25} />
            <stop offset="95%" stopColor={colors.blue} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="t"
          type="number"
          domain={["dataMin", "dataMax"]}
          tickFormatter={(v: number) => formatClock(v)}
          tick={{ fill: colors.axis, fontSize: 10 }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          tick={{ fill: colors.axis, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatTokens(v)}
          width={46}
        />
        <Tooltip
          content={
            <TooltipShell
              formatLabel={(l) => (typeof l === "number" ? formatClock(l) : String(l))}
              renderItem={(e) => formatTokens(num(e.value))}
            />
          }
          cursor={{ fill: colors.cursor }}
        />
        <ReferenceLine
          y={limit}
          stroke={colors.red}
          strokeDasharray="4 4"
          label={{ value: "limit", position: "insideTopRight", fill: colors.red, fontSize: 9 }}
        />
        <ReferenceLine
          y={max}
          stroke={colors.orange}
          strokeDasharray="3 3"
          label={{ value: "max", position: "insideTopLeft", fill: colors.orange, fontSize: 9 }}
        />
        <ReferenceLine
          y={mean}
          stroke={colors.yellow}
          strokeDasharray="2 2"
          label={{ value: "mean", position: "insideBottomLeft", fill: colors.yellow, fontSize: 9 }}
        />
        {compMarkers.map((c, i) => (
          <ReferenceLine key={`line-${i}`} x={c.t} stroke={colors.purple} strokeDasharray="2 3" strokeOpacity={0.5} />
        ))}
        {compMarkers.map((c, i) => (
          <ReferenceDot key={`dot-${i}`} x={c.t} y={c.tokens} r={3.5} fill={colors.purple} stroke="none" />
        ))}
        <Line
          type="monotone"
          dataKey="tokens"
          name="Context"
          stroke={colors.blue}
          strokeWidth={2}
          dot={false}
          fill="url(#ctxFill)"
          animationDuration={700}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function TokensPerTurnChart({ data, colors }: { data: TurnPoint[]; colors: Colors }) {
  if (data.length === 0) return <Empty text="No turn data" />;
  const maxTokens = Math.max(...data.map((d) => d.tokens), 1);
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: colors.axis, fontSize: 9 }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
          interval={Math.max(0, Math.floor(data.length / 12) - 1)}
        />
        <YAxis
          tick={{ fill: colors.axis, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatTokens(v)}
          width={46}
        />
        <Tooltip content={<TurnTooltip />} cursor={{ fill: colors.cursor }} />
        <Bar dataKey="tokens" name="Tokens" radius={[3, 3, 0, 0]} maxBarSize={18} animationDuration={600}>
          {data.map((d, i) => (
            <Cell key={i} fill={colors.blue} fillOpacity={0.35 + 0.6 * (d.tokens / maxTokens)} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function CumulativeCostChart({ data, colors }: { data: CostSeriesPoint[]; colors: Colors }) {
  if (data.length === 0) return <Empty text="No cost data yet" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id="costFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={colors.green} stopOpacity={0.35} />
            <stop offset="95%" stopColor={colors.green} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: colors.axis, fontSize: 10 }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
          minTickGap={50}
        />
        <YAxis
          tick={{ fill: colors.axis, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${v.toFixed(2)}`}
          width={50}
        />
        <Tooltip content={<TooltipShell renderItem={(e) => formatCost(num(e.value))} />} cursor={{ fill: colors.cursor }} />
        <Area
          type="stepAfter"
          dataKey="cost"
          name="Cost"
          stroke={colors.green}
          strokeWidth={2}
          fill="url(#costFill)"
          animationDuration={600}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

function CostPerTurnChart({ data, colors }: { data: TurnPoint[]; colors: Colors }) {
  if (data.length === 0) return <Empty text="No turn data" />;
  const maxCost = Math.max(...data.map((d) => d.cost), 0.0001);
  const ratioColor = (cost: number) => {
    const r = cost / maxCost;
    if (r > 0.7) return colors.red;
    if (r > 0.4) return colors.orange;
    if (r > 0.2) return colors.yellow;
    return colors.green;
  };
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: colors.axis, fontSize: 9 }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
          interval={Math.max(0, Math.floor(data.length / 12) - 1)}
        />
        <YAxis
          tick={{ fill: colors.axis, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `$${v.toFixed(2)}`}
          width={50}
        />
        <Tooltip content={<TurnTooltip />} cursor={{ fill: colors.cursor }} />
        <Bar dataKey="cost" name="Cost" radius={[3, 3, 0, 0]} maxBarSize={18} animationDuration={600}>
          {data.map((d, i) => (
            <Cell key={i} fill={ratioColor(d.cost)} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ModelCostChart({ breakdown, colors }: { breakdown: SessionData["modelBreakdown"]; colors: Colors }) {
  const entries = Object.entries(breakdown)
    .sort((a, b) => b[1].cost - a[1].cost)
    .slice(0, 6);
  if (entries.length === 0) return <Empty text="No model data" />;
  const palette = [colors.blue, colors.purple, colors.green, colors.orange, colors.yellow, colors.red];
  const data = entries.map(([name, mb]) => ({ name, cost: mb.cost, calls: mb.count }));
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} layout="vertical" margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: colors.axis, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatCost(v)}
        />
        <YAxis
          type="category"
          dataKey="name"
          tick={{ fill: colors.axis, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          width={88}
        />
        <Tooltip
          content={
            <TooltipShell
              renderItem={(e) => {
                const calls = num(e.payload?.calls);
                return `${formatCost(num(e.value))} (${calls} calls)`;
              }}
            />
          }
          cursor={{ fill: colors.cursor }}
        />
        <Bar dataKey="cost" name="Cost" radius={[0, 3, 3, 0]} maxBarSize={16} animationDuration={600}>
          {data.map((d, i) => (
            <Cell key={d.name} fill={palette[i % palette.length]} fillOpacity={0.85} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function ToolBars({ usage, colors }: { usage: Record<string, number>; colors: Colors }) {
  const tools = Object.entries(usage).sort((a, b) => b[1] - a[1]).slice(0, 8);
  if (tools.length === 0) return <Empty text="No tool calls" />;
  const maxCount = tools[0][1] || 1;
  return (
    <div className="space-y-2">
      {tools.map(([name, count]) => (
        <div key={name} className="flex items-center gap-3">
          <span className="w-20 shrink-0 truncate text-right text-[10px] text-[var(--text-secondary)]">{name}</span>
          <div className="h-4 flex-1 overflow-hidden rounded bg-[var(--bg-secondary)]">
            <div
              className="h-full rounded transition-all duration-500"
              style={{ width: `${Math.max((count / maxCount) * 100, 6)}%`, backgroundColor: colors.orange, opacity: 0.35 }}
            />
          </div>
          <span className="w-6 shrink-0 text-[10px] font-semibold" style={{ color: colors.orange }}>
            {count}
          </span>
        </div>
      ))}
      {Object.keys(usage).length > 8 && (
        <div className="pt-1 text-[9px] text-[var(--text-secondary)]">
          +{Object.keys(usage).length - 8} more tools
        </div>
      )}
    </div>
  );
}

function ContextStats({ m, limit, colors }: { m: Metrics; limit: number; colors: Colors }) {
  const rows = [
    { label: "Current", value: formatTokens(m.currentCtx), color: colors.blue, sub: `${m.currentPct.toFixed(1)}% of limit` },
    { label: "Peak", value: formatTokens(m.contextMax), color: colors.orange, sub: limit > 0 ? `${((m.contextMax / limit) * 100).toFixed(1)}% of limit` : "" },
    { label: "Mean", value: formatTokens(m.contextMean), color: colors.yellow, sub: "average snapshot" },
    { label: "Median", value: formatTokens(m.contextMedian), color: colors.green, sub: "middle snapshot" },
    { label: "p95", value: formatTokens(m.contextP95), color: colors.red, sub: "95th percentile" },
    { label: "Limit", value: formatTokens(limit), color: colors.purple, sub: "context window" },
  ];
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
      {rows.map((r) => (
        <div key={r.label} className="rounded-lg bg-[var(--bg-secondary)] p-3">
          <div className="text-[9px] uppercase tracking-wider text-[var(--text-secondary)]">{r.label}</div>
          <div className="mt-0.5 text-lg font-bold" style={{ color: r.color }}>
            {r.value}
          </div>
          <div className="text-[9px] text-[var(--text-secondary)]">{r.sub}</div>
        </div>
      ))}
      <div className="col-span-2 rounded-lg bg-[var(--bg-secondary)] p-3 sm:col-span-3">
        <div className="flex items-center justify-between text-[9px]">
          <span className="uppercase tracking-wider text-[var(--text-secondary)]">Cache hit ratio</span>
          <span className="font-bold" style={{ color: colors.green }}>
            {(m.cacheHitRatio * 100).toFixed(1)}%
          </span>
        </div>
        <div className="mt-1.5 h-1.5 w-full overflow-hidden rounded-full bg-[var(--bg-primary)]">
          <div
            className="h-full rounded-full transition-all duration-700"
            style={{ width: `${Math.min(m.cacheHitRatio * 100, 100)}%`, backgroundColor: colors.green }}
          />
        </div>
      </div>
    </div>
  );
}

function TurnDurationChart({ data, avgMs, colors }: { data: TurnPoint[]; avgMs: number; colors: Colors }) {
  if (data.length === 0) return <Empty text="No turn data" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: colors.axis, fontSize: 9 }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
          interval={Math.max(0, Math.floor(data.length / 12) - 1)}
        />
        <YAxis
          tick={{ fill: colors.axis, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => formatDuration(v)}
          width={56}
        />
        <Tooltip content={<TooltipShell renderItem={(e) => formatDuration(num(e.value))} />} cursor={{ fill: colors.cursor }} />
        <ReferenceLine
          y={avgMs}
          stroke={colors.orange}
          strokeDasharray="4 4"
          label={{ value: "avg", position: "insideTopRight", fill: colors.orange, fontSize: 9 }}
        />
        <Bar dataKey="dur" name="Turn duration" fill={colors.purple} fillOpacity={0.8} radius={[3, 3, 0, 0]} maxBarSize={18} animationDuration={600} />
      </BarChart>
    </ResponsiveContainer>
  );
}

function LatencyChart({ data, avgMs, colors }: { data: LatencyPoint[]; avgMs: number; colors: Colors }) {
  if (data.length === 0) return <Empty text="No latency data" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: colors.axis, fontSize: 9 }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis
          tick={{ fill: colors.axis, fontSize: 10 }}
          axisLine={false}
          tickLine={false}
          tickFormatter={(v: number) => `${(v / 1000).toFixed(1)}s`}
          width={44}
        />
        <Tooltip content={<TooltipShell renderItem={(e) => formatDuration(num(e.value))} />} cursor={{ fill: colors.cursor }} />
        <ReferenceLine
          y={avgMs}
          stroke={colors.purple}
          strokeDasharray="4 4"
          label={{ value: "avg", position: "insideTopRight", fill: colors.purple, fontSize: 9 }}
        />
        <Line
          type="monotone"
          dataKey="latencyMs"
          name="Latency"
          stroke={colors.orange}
          strokeWidth={2}
          dot={{ r: 2.5, fill: colors.orange, strokeWidth: 0 }}
          animationDuration={600}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

function ActivityDensityChart({ data, colors }: { data: DensityPoint[]; colors: Colors }) {
  if (data.length === 0) return <Empty text="No activity to chart" />;
  return (
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
        <CartesianGrid stroke={colors.grid} strokeDasharray="3 3" vertical={false} />
        <XAxis
          dataKey="label"
          tick={{ fill: colors.axis, fontSize: 9 }}
          axisLine={{ stroke: colors.grid }}
          tickLine={false}
          minTickGap={40}
        />
        <YAxis tick={{ fill: colors.axis, fontSize: 10 }} axisLine={false} tickLine={false} width={30} allowDecimals={false} />
        <Tooltip content={<TooltipShell renderItem={(e) => String(e.value)} />} cursor={{ fill: colors.cursor }} />
        <Bar dataKey="user" name="User" stackId="activity" fill={colors.blue} fillOpacity={0.8} maxBarSize={14} animationDuration={600} />
        <Bar dataKey="tool" name="Tool" stackId="activity" fill={colors.orange} fillOpacity={0.8} maxBarSize={14} animationDuration={600} />
        <Bar dataKey="other" name="Other" stackId="activity" fill={colors.purple} fillOpacity={0.8} maxBarSize={14} animationDuration={600} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function SessionOverview({ session }: { session: SessionData }) {
  const colors = useChartColors();
  const m = useMemo(() => deriveMetrics(session), [session]);

  const hasAnyData = m.totalAll > 0 || session.messages.length > 0 || session.timeline.length > 0;
  if (!hasAnyData) {
    return (
      <div className="flex h-64 items-center justify-center rounded-xl border border-[var(--border)] bg-[var(--bg-card)]">
        <div className="text-center">
          <div className="mx-auto h-3 w-3 rounded-full bg-[var(--accent-blue)]" />
          <p className="mt-3 text-sm text-[var(--text-secondary)]">No session data to display yet</p>
        </div>
      </div>
    );
  }

  const tt = session.totalTokens;
  const tokenLegend = (
    <div className="flex flex-wrap items-center gap-2.5">
      {[
        ["Input", colors.blue],
        ["Cache read", colors.yellow],
        ["Cache write", colors.orange],
        ["Output", colors.purple],
        ["Reasoning", colors.red],
      ].map(([name, color]) => (
        <span key={name} className="flex items-center gap-1 text-[9px] text-[var(--text-secondary)]">
          <span className="h-2 w-2 rounded-sm" style={{ background: color }} />
          {name}
        </span>
      ))}
    </div>
  );

  const contextRight = session.compactions.length > 0 ? (
    <span className="flex items-center gap-1.5 text-[9px] text-[var(--accent-purple)]">
      <span className="h-2 w-2 rounded-full bg-[var(--accent-purple)]" />
      {session.compactions.length} compaction{session.compactions.length !== 1 ? "s" : ""}
    </span>
  ) : (
    <span className="text-[9px] text-[var(--text-secondary)]">
      {m.contextSeries.length} snapshots
    </span>
  );

  const tokenChips = [
    { label: "Input", value: formatTokens(tt.inputTokens), color: colors.blue },
    { label: "Output", value: formatTokens(tt.outputTokens), color: colors.purple },
    { label: "Cache W", value: formatTokens(tt.cacheCreationTokens), color: colors.orange },
    { label: "Cache R", value: formatTokens(tt.cacheReadTokens), color: colors.yellow },
    { label: "Reasoning", value: formatTokens(tt.reasoningTokens), color: colors.red },
    { label: "Cache hit", value: `${(m.cacheHitRatio * 100).toFixed(1)}%`, color: colors.green },
  ];

  const costChips = [
    { label: "Total", value: formatCost(session.totalCost), color: colors.green },
    { label: "Avg/turn", value: formatCost(m.avgCostPerTurn), color: colors.blue },
    { label: "Per 1K", value: formatCost(m.costPer1k), color: colors.yellow },
    {
      label: "Top turn",
      value: m.mostExpensiveTurn ? `T${m.mostExpensiveTurn.turnIndex + 1} \u00b7 ${formatCost(m.mostExpensiveTurn.cost)}` : "\u2014",
      color: colors.red,
    },
  ];

  const perfChips = [
    { label: "Wall", value: formatDuration(m.wallMs), color: colors.purple },
    { label: "Avg turn", value: formatDuration(m.avgTurnMs), color: colors.orange },
    { label: "Avg latency", value: formatDuration(m.avgLatencyMs), color: colors.yellow },
    { label: "Throughput", value: m.wallMs > 0 ? `${Math.round(m.tokensPerMin).toLocaleString()} tok/min` : "\u2014", color: colors.green },
    { label: "Turns/hr", value: m.wallMs > 0 ? m.turnsPerHour.toFixed(1) : "\u2014", color: colors.blue },
    { label: "Tools/min", value: m.wallMs > 0 ? m.toolCallsPerMin.toFixed(1) : "\u2014", color: colors.orange },
  ];

  return (
    <div className="space-y-2">
      <div className="grid grid-cols-12 gap-5">
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <Kpi label="Total Tokens" value={formatTokens(m.totalAll)} accent={colors.blue} sub={`${m.totalAll.toLocaleString()} tokens across session`} delay={0} />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <Kpi label="Total Cost" value={formatCost(session.totalCost)} accent={colors.green} sub={`${formatCost(m.costPer1k)} per 1K tokens`} delay={60} />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <Kpi label="Wall Duration" value={formatDuration(m.wallMs)} accent={colors.purple} sub={`${session.costPerTurn.length} turns \u00b7 ${session.messageCount} messages`} delay={120} />
        </div>
        <div className="col-span-12 sm:col-span-6 lg:col-span-3">
          <Kpi label="Avg Response Latency" value={formatDuration(m.avgLatencyMs)} accent={colors.orange} sub={`${m.latencySeries.length} responses timed`} delay={180} />
        </div>
        <ContextKpi session={session} m={m} colors={colors} delay={240} />
      </div>

      <Section title="Tokens" subtitle="Token accounting & context window" accent={colors.blue} chips={tokenChips}>
        <div className="grid grid-cols-12 gap-5">
          <Panel title="Token Stream" right={tokenLegend} className="col-span-12 lg:col-span-7" delay={0}>
            <div className="h-48 lg:h-56">
              <TokenStreamChart data={m.tokenSeries} colors={colors} />
            </div>
          </Panel>
          <Panel title="Context Window Usage" right={contextRight} className="col-span-12 lg:col-span-5" delay={60}>
            <div className="h-48 lg:h-56">
              <ContextChart
                series={m.contextSeries}
                limit={session.contextLimit}
                mean={m.contextMean}
                max={m.contextMax}
                compMarkers={m.compMarkers}
                colors={colors}
              />
            </div>
          </Panel>
          <Panel title="Tokens per Turn" className="col-span-12 lg:col-span-7" delay={120}>
            <div className="h-44 lg:h-48">
              <TokensPerTurnChart data={m.turnSeries} colors={colors} />
            </div>
          </Panel>
          <Panel title="Context Stats" className="col-span-12 lg:col-span-5" delay={180}>
            <ContextStats m={m} limit={session.contextLimit} colors={colors} />
          </Panel>
        </div>
      </Section>

      <Section title="Cost" subtitle="Spend breakdown" accent={colors.green} chips={costChips}>
        <div className="grid grid-cols-12 gap-5">
          <Panel title="Cumulative Cost" className="col-span-12 lg:col-span-7" delay={0}>
            <div className="h-48 lg:h-56">
              <CumulativeCostChart data={m.costSeries} colors={colors} />
            </div>
          </Panel>
          <Panel title="Cost per Turn" className="col-span-12 lg:col-span-5" delay={60}>
            <div className="h-48 lg:h-56">
              <CostPerTurnChart data={m.turnSeries} colors={colors} />
            </div>
          </Panel>
          <Panel title="Model Cost" className="col-span-12 lg:col-span-7" delay={120}>
            <div className="h-40 lg:h-44">
              <ModelCostChart breakdown={session.modelBreakdown} colors={colors} />
            </div>
          </Panel>
          <Panel title="Tool Usage" className="col-span-12 lg:col-span-5" delay={180}>
            <ToolBars usage={session.toolUsage} colors={colors} />
          </Panel>
        </div>
      </Section>

      <Section title="Performance" subtitle="Timing & throughput" accent={colors.purple} chips={perfChips}>
        <div className="grid grid-cols-12 gap-5">
          <Panel title="Turn Duration" className="col-span-12 lg:col-span-7" delay={0}>
            <div className="h-48 lg:h-56">
              <TurnDurationChart data={m.turnSeries} avgMs={m.avgTurnMs} colors={colors} />
            </div>
          </Panel>
          <Panel title="Response Latency" className="col-span-12 lg:col-span-5" delay={60}>
            <div className="h-48 lg:h-56">
              <LatencyChart data={m.latencySeries} avgMs={m.avgLatencyMs} colors={colors} />
            </div>
          </Panel>
          <Panel title="Activity Density" right={<span className="text-[9px] text-[var(--text-secondary)]">{m.totalToolCalls} tool calls</span>} className="col-span-12" delay={120}>
            <div className="h-40 lg:h-48">
              <ActivityDensityChart data={m.density} colors={colors} />
            </div>
          </Panel>
        </div>
      </Section>
    </div>
  );
}
