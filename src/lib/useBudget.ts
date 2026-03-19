"use client";

import { useEffect, useState, useCallback, useRef } from "react";

export interface BudgetConfig {
  daily: number | null;
  weekly: number | null;
  monthly: number | null;
  notifyAt: number; // percentage threshold (default 90)
  enabled: boolean;
}

export interface BudgetStatus {
  daily: { spent: number; limit: number | null; pct: number } | null;
  weekly: { spent: number; limit: number | null; pct: number } | null;
  monthly: { spent: number; limit: number | null; pct: number } | null;
  alerts: BudgetAlert[];
}

export interface BudgetAlert {
  type: "daily" | "weekly" | "monthly";
  level: "warning" | "exceeded";
  pct: number;
  spent: number;
  limit: number;
}

const NOTIFIED_KEY = "cci-budget-notified";

const DEFAULT_CONFIG: BudgetConfig = {
  daily: null,
  weekly: null,
  monthly: null,
  notifyAt: 90,
  enabled: true,
};

// Track which alerts have already fired browser notifications this session
function getNotifiedKeys(): Set<string> {
  try {
    const stored = sessionStorage.getItem(NOTIFIED_KEY);
    if (stored) return new Set(JSON.parse(stored));
  } catch {}
  return new Set();
}

function addNotifiedKey(key: string) {
  const keys = getNotifiedKeys();
  keys.add(key);
  sessionStorage.setItem(NOTIFIED_KEY, JSON.stringify([...keys]));
}

function sendNotification(title: string, body: string) {
  if (typeof window === "undefined") return;
  if (!("Notification" in window)) return;

  if (Notification.permission === "granted") {
    new Notification(title, { body, icon: "/favicon.ico" });
  } else if (Notification.permission !== "denied") {
    Notification.requestPermission().then((perm) => {
      if (perm === "granted") {
        new Notification(title, { body, icon: "/favicon.ico" });
      }
    });
  }
}

export function useBudget() {
  const [config, setConfigState] = useState<BudgetConfig>(DEFAULT_CONFIG);
  const [status, setStatus] = useState<BudgetStatus>({ daily: null, weekly: null, monthly: null, alerts: [] });
  const [loading, setLoading] = useState(true);
  const prevAlertsRef = useRef<string>("");
  const configLoaded = useRef(false);

  // Load config from server on mount
  useEffect(() => {
    fetch("/api/budget")
      .then((r) => r.json())
      .then((data) => {
        if (!data.error) {
          setConfigState({ ...DEFAULT_CONFIG, ...data });
        }
        configLoaded.current = true;
      })
      .catch(() => {
        configLoaded.current = true;
      });
  }, []);

  const setConfig = useCallback((updates: Partial<BudgetConfig>) => {
    setConfigState((prev) => {
      const next = { ...prev, ...updates };
      // Save to server (fire and forget, optimistic update)
      fetch("/api/budget", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      }).catch(() => {});
      return next;
    });
  }, []);

  // Fetch spending and compute budget status
  const checkBudget = useCallback(async () => {
    if (!config.enabled) {
      setStatus({ daily: null, weekly: null, monthly: null, alerts: [] });
      setLoading(false);
      return;
    }

    try {
      const res = await fetch("/api/spending?days=31");
      const data: { date: string; cost: number }[] = await res.json();

      const now = new Date();
      const today = now.toISOString().slice(0, 10);

      // Daily spend
      const dailySpent = data.filter((d) => d.date === today).reduce((s, d) => s + d.cost, 0);

      // Weekly spend (last 7 days)
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      const weeklySpent = data
        .filter((d) => new Date(d.date + "T00:00:00") >= weekAgo)
        .reduce((s, d) => s + d.cost, 0);

      // Monthly spend (last 30 days)
      const monthAgo = new Date(now);
      monthAgo.setDate(monthAgo.getDate() - 30);
      const monthlySpent = data
        .filter((d) => new Date(d.date + "T00:00:00") >= monthAgo)
        .reduce((s, d) => s + d.cost, 0);

      const alerts: BudgetAlert[] = [];

      const check = (type: "daily" | "weekly" | "monthly", spent: number, limit: number | null) => {
        if (limit == null || limit <= 0) return null;
        const pct = (spent / limit) * 100;
        if (pct >= 100) {
          alerts.push({ type, level: "exceeded", pct, spent, limit });
        } else if (pct >= config.notifyAt) {
          alerts.push({ type, level: "warning", pct, spent, limit });
        }
        return { spent, limit, pct };
      };

      const daily = check("daily", dailySpent, config.daily);
      const weekly = check("weekly", weeklySpent, config.weekly);
      const monthly = check("monthly", monthlySpent, config.monthly);

      setStatus({ daily, weekly, monthly, alerts });
      setLoading(false);

      // Fire browser notifications for new alerts
      const alertKey = alerts.map((a) => `${a.type}-${a.level}`).join(",");
      if (alertKey && alertKey !== prevAlertsRef.current) {
        const notified = getNotifiedKeys();
        for (const alert of alerts) {
          const key = `${alert.type}-${alert.level}-${today}`;
          if (!notified.has(key)) {
            const label = alert.type.charAt(0).toUpperCase() + alert.type.slice(1);
            if (alert.level === "exceeded") {
              sendNotification(
                `Budget Exceeded`,
                `Your ${label.toLowerCase()} budget of $${alert.limit.toFixed(2)} has been exceeded. Current spend: $${alert.spent.toFixed(2)}`
              );
            } else {
              sendNotification(
                `Budget Warning`,
                `You've used ${alert.pct.toFixed(0)}% of your ${label.toLowerCase()} budget ($${alert.spent.toFixed(2)} / $${alert.limit.toFixed(2)})`
              );
            }
            addNotifiedKey(key);
          }
        }
      }
      prevAlertsRef.current = alertKey;
    } catch {
      setLoading(false);
    }
  }, [config]);

  useEffect(() => {
    checkBudget();
    const interval = setInterval(checkBudget, 30000); // check every 30s
    return () => clearInterval(interval);
  }, [checkBudget]);

  return { config, setConfig, status, loading, checkBudget };
}
