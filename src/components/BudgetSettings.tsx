"use client";

import { useState } from "react";
import type { BudgetConfig, BudgetStatus } from "@/lib/useBudget";

function formatCost(cost: number): string {
  if (cost < 0.01) return `$${cost.toFixed(4)}`;
  if (cost < 1) return `$${cost.toFixed(3)}`;
  return `$${cost.toFixed(2)}`;
}

function BudgetMeter({
  label,
  spent,
  limit,
  pct,
}: {
  label: string;
  spent: number;
  limit: number;
  pct: number;
}) {
  const clampedPct = Math.min(pct, 100);
  const color =
    pct >= 100
      ? "var(--accent-red)"
      : pct >= 90
        ? "var(--accent-orange)"
        : pct >= 70
          ? "var(--accent-yellow)"
          : "var(--accent-green)";

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center justify-between mb-3">
        <span className="text-xs uppercase tracking-wider text-[var(--text-secondary)]">
          {label}
        </span>
        <span className="text-xs text-[var(--text-secondary)]">
          {formatCost(spent)} / {formatCost(limit)}
        </span>
      </div>

      {/* Progress bar */}
      <div className="h-3 w-full overflow-hidden rounded-full bg-[var(--bg-secondary)]">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{
            width: `${clampedPct}%`,
            backgroundColor: color,
          }}
        />
      </div>

      <div className="mt-2 flex items-center justify-between">
        <span className="text-2xl font-bold" style={{ color }}>
          {pct.toFixed(0)}%
        </span>
        <span className="text-xs text-[var(--text-secondary)]">
          {formatCost(Math.max(limit - spent, 0))} remaining
        </span>
      </div>

      {pct >= 100 && (
        <div className="mt-3 flex items-center gap-2 rounded-lg border border-[var(--accent-red)]30 bg-[var(--accent-red)]08 px-3 py-2">
          <svg className="h-4 w-4 shrink-0" style={{ color: "var(--accent-red)" }} fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
          </svg>
          <span className="text-xs" style={{ color: "var(--accent-red)" }}>
            Budget exceeded by {formatCost(spent - limit)}
          </span>
        </div>
      )}
    </div>
  );
}

function BudgetInput({
  label,
  description,
  value,
  onChange,
}: {
  label: string;
  description: string;
  value: number | null;
  onChange: (v: number | null) => void;
}) {
  const [inputValue, setInputValue] = useState(value?.toString() || "");

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value;
    setInputValue(raw);
    if (raw === "") {
      onChange(null);
    } else {
      const num = parseFloat(raw);
      if (!isNaN(num) && num >= 0) onChange(num);
    }
  };

  return (
    <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
      <div className="flex items-center justify-between mb-2">
        <div>
          <div className="text-sm font-medium text-[var(--text-primary)]">{label}</div>
          <div className="text-[10px] text-[var(--text-secondary)]">{description}</div>
        </div>
      </div>
      <div className="relative">
        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[var(--text-secondary)]">
          $
        </span>
        <input
          type="number"
          min="0"
          step="0.5"
          value={inputValue}
          onChange={handleChange}
          placeholder="No limit"
          className="w-full rounded-lg border border-[var(--border)] bg-[var(--bg-secondary)] px-3 py-2.5 pl-7 text-sm text-[var(--text-primary)] placeholder:text-[var(--text-secondary)] focus:border-[var(--accent-purple)] focus:outline-none transition-colors"
        />
      </div>
    </div>
  );
}

export function BudgetSettings({
  config,
  status,
  loading,
  onConfigChange,
}: {
  config: BudgetConfig;
  status: BudgetStatus;
  loading: boolean;
  onConfigChange: (updates: Partial<BudgetConfig>) => void;
}) {
  const hasAnyBudget = config.daily != null || config.weekly != null || config.monthly != null;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-bold">Budget</h2>
          <p className="text-xs text-[var(--text-secondary)]">
            Set spending limits and get notified before exceeding them
          </p>
        </div>
        <button
          onClick={() => onConfigChange({ enabled: !config.enabled })}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${
            config.enabled ? "bg-[var(--accent-green)]" : "bg-[var(--border)]"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 rounded-full bg-white transition-transform ${
              config.enabled ? "translate-x-[22px]" : "translate-x-[3px]"
            }`}
          />
        </button>
      </div>

      {!config.enabled && (
        <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-8 text-center">
          <svg className="mx-auto h-10 w-10 text-[var(--text-secondary)] opacity-30" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 6v12m-3-2.818l.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="mt-3 text-sm text-[var(--text-secondary)]">
            Budget tracking is disabled
          </p>
          <p className="mt-1 text-xs text-[var(--text-secondary)]">
            Enable it above to set spending limits
          </p>
        </div>
      )}

      {config.enabled && (
        <>
          {/* Active budget alerts */}
          {status.alerts.length > 0 && (
            <div className="space-y-2">
              {status.alerts.map((alert) => (
                <div
                  key={`${alert.type}-${alert.level}`}
                  className={`flex items-center gap-3 rounded-xl border px-4 py-3 ${
                    alert.level === "exceeded"
                      ? "border-[var(--accent-red)] bg-[#f8717110]"
                      : "border-[var(--accent-orange)] bg-[#fb923c10]"
                  }`}
                >
                  <svg
                    className="h-5 w-5 shrink-0"
                    style={{ color: alert.level === "exceeded" ? "var(--accent-red)" : "var(--accent-orange)" }}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                  <div>
                    <div
                      className="text-xs font-semibold"
                      style={{ color: alert.level === "exceeded" ? "var(--accent-red)" : "var(--accent-orange)" }}
                    >
                      {alert.type.charAt(0).toUpperCase() + alert.type.slice(1)} budget{" "}
                      {alert.level === "exceeded" ? "exceeded" : `at ${alert.pct.toFixed(0)}%`}
                    </div>
                    <div className="text-[10px] text-[var(--text-secondary)]">
                      {formatCost(alert.spent)} spent of {formatCost(alert.limit)} limit
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Budget meters */}
          {!loading && hasAnyBudget && (
            <div className="grid grid-cols-3 gap-4">
              {status.daily && (
                <BudgetMeter
                  label="Daily"
                  spent={status.daily.spent}
                  limit={status.daily.limit!}
                  pct={status.daily.pct}
                />
              )}
              {status.weekly && (
                <BudgetMeter
                  label="Weekly"
                  spent={status.weekly.spent}
                  limit={status.weekly.limit!}
                  pct={status.weekly.pct}
                />
              )}
              {status.monthly && (
                <BudgetMeter
                  label="Monthly"
                  spent={status.monthly.spent}
                  limit={status.monthly.limit!}
                  pct={status.monthly.pct}
                />
              )}
            </div>
          )}

          {/* Budget configuration */}
          <div>
            <div className="text-xs uppercase tracking-wider text-[var(--text-secondary)] mb-3">
              Configure Limits
            </div>
            <div className="grid grid-cols-3 gap-4">
              <BudgetInput
                label="Daily Limit"
                description="Max spend per day"
                value={config.daily}
                onChange={(v) => onConfigChange({ daily: v })}
              />
              <BudgetInput
                label="Weekly Limit"
                description="Max spend per 7 days"
                value={config.weekly}
                onChange={(v) => onConfigChange({ weekly: v })}
              />
              <BudgetInput
                label="Monthly Limit"
                description="Max spend per 30 days"
                value={config.monthly}
                onChange={(v) => onConfigChange({ monthly: v })}
              />
            </div>
          </div>

          {/* Notification threshold */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center justify-between mb-3">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  Warning Threshold
                </div>
                <div className="text-[10px] text-[var(--text-secondary)]">
                  Get notified when spending reaches this percentage of your budget
                </div>
              </div>
              <span className="text-lg font-bold text-[var(--accent-orange)]">
                {config.notifyAt}%
              </span>
            </div>
            <input
              type="range"
              min="50"
              max="99"
              value={config.notifyAt}
              onChange={(e) => onConfigChange({ notifyAt: parseInt(e.target.value) })}
              className="w-full accent-[var(--accent-orange)]"
            />
            <div className="mt-1 flex justify-between text-[9px] text-[var(--text-secondary)]">
              <span>50%</span>
              <span>99%</span>
            </div>
          </div>

          {/* Notification permission */}
          <div className="rounded-xl border border-[var(--border)] bg-[var(--bg-card)] p-5">
            <div className="flex items-center justify-between">
              <div>
                <div className="text-sm font-medium text-[var(--text-primary)]">
                  Browser Notifications
                </div>
                <div className="text-[10px] text-[var(--text-secondary)]">
                  Get system notifications when budget thresholds are reached
                </div>
              </div>
              <NotificationButton />
            </div>
          </div>
        </>
      )}
    </div>
  );
}

function NotificationButton() {
  const [permission, setPermission] = useState<NotificationPermission>(
    typeof window !== "undefined" && "Notification" in window
      ? Notification.permission
      : "default"
  );

  if (!("Notification" in globalThis)) {
    return (
      <span className="text-xs text-[var(--text-secondary)]">Not supported</span>
    );
  }

  if (permission === "granted") {
    return (
      <span className="flex items-center gap-1.5 text-xs text-[var(--accent-green)]">
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
        </svg>
        Enabled
      </span>
    );
  }

  if (permission === "denied") {
    return (
      <span className="text-xs text-[var(--accent-red)]">Blocked</span>
    );
  }

  return (
    <button
      onClick={async () => {
        const perm = await Notification.requestPermission();
        setPermission(perm);
      }}
      className="rounded-lg border border-[var(--accent-purple)] px-3 py-1.5 text-xs text-[var(--accent-purple)] transition-colors hover:bg-[var(--accent-purple)]15"
    >
      Enable
    </button>
  );
}
