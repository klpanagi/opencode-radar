import { NextResponse } from "next/server";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import { getInsightsDir } from "@/lib/parser";

export const dynamic = "force-dynamic";

function configPath(): string {
  return join(getInsightsDir(), "insights-config.json");
}

const DEFAULT_CONFIG = { daily: null, weekly: null, monthly: null, notifyAt: 90, enabled: true };

function readConfig() {
  try {
    const p = configPath();
    if (existsSync(p)) return { ...DEFAULT_CONFIG, ...JSON.parse(readFileSync(p, "utf-8")) };
  } catch {}
  return DEFAULT_CONFIG;
}

export async function GET() {
  return NextResponse.json(readConfig());
}

function sanitizeConfig(input: Record<string, unknown>): Partial<typeof DEFAULT_CONFIG> {
  const result: Record<string, unknown> = {};
  if ("daily" in input) result.daily = typeof input.daily === "number" && input.daily >= 0 ? input.daily : null;
  if ("weekly" in input) result.weekly = typeof input.weekly === "number" && input.weekly >= 0 ? input.weekly : null;
  if ("monthly" in input) result.monthly = typeof input.monthly === "number" && input.monthly >= 0 ? input.monthly : null;
  if ("notifyAt" in input) { const n = Number(input.notifyAt); if (!isNaN(n) && n >= 50 && n <= 99) result.notifyAt = n; }
  if ("enabled" in input) result.enabled = Boolean(input.enabled);
  return result;
}

export async function PUT(request: Request) {
  try {
    const raw = await request.json();
    const updates = sanitizeConfig(raw);
    const merged = { ...readConfig(), ...updates };
    writeFileSync(configPath(), JSON.stringify(merged, null, 2), "utf-8");
    return NextResponse.json(merged);
  } catch {
    return NextResponse.json({ error: "Failed to save config" }, { status: 500 });
  }
}
