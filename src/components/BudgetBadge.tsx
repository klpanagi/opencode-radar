"use client";

import type { BudgetStatus } from "@/lib/useBudget";

export function BudgetBadge({ status, onClick }: { status: BudgetStatus; onClick: () => void }) {
  if (status.alerts.length === 0) return null;

  const worst = status.alerts.reduce((a, b) => (a.pct > b.pct ? a : b));
  const isExceeded = worst.level === "exceeded";

  return (
    <button
      onClick={onClick}
      className={`flex items-center gap-2 rounded-lg px-3 py-2 text-left transition-all w-full ${
        isExceeded
          ? "border border-[var(--accent-red)] bg-[#f8717115]"
          : "border border-[var(--accent-orange)] bg-[#fb923c15]"
      }`}
    >
      <svg
        className="h-4 w-4 shrink-0"
        style={{ color: isExceeded ? "var(--accent-red)" : "var(--accent-orange)" }}
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L4.082 16.5c-.77.833.192 2.5 1.732 2.5z"
        />
      </svg>
      <div className="min-w-0">
        <div
          className="text-[10px] font-semibold truncate"
          style={{ color: isExceeded ? "var(--accent-red)" : "var(--accent-orange)" }}
        >
          {isExceeded ? "Budget exceeded" : `${worst.pct.toFixed(0)}% of budget`}
        </div>
        <div className="text-[9px] text-[var(--text-secondary)]">
          {worst.type} limit
        </div>
      </div>
    </button>
  );
}
