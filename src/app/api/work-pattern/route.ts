import { NextResponse } from "next/server";
import { readFileSync } from "fs";
import { listProjects } from "@/lib/parser";
import { calculateCost } from "@/lib/pricing";
import type { TokenUsage } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export interface WorkPatternCell {
  day: number;  // 0=Sun … 6=Sat
  hour: number; // 0-23
  cost: number;
  sessions: number;
  tokens: number;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const days = Math.min(parseInt(searchParams.get("days") || "90", 10), 365);

  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  const grid = new Map<string, WorkPatternCell>();
  const sessionBuckets = new Map<string, Set<string>>();

  for (const project of listProjects()) {
    for (const session of project.sessions) {
      if (new Date(session.modifiedAt) < cutoff) continue;

      try {
        const lines = readFileSync(session.file, "utf-8")
          .split("\n")
          .filter((l) => l.trim());

        for (const line of lines) {
          try {
            const raw = JSON.parse(line);
            if (raw.type !== "assistant" || !raw.message?.usage || !raw.message?.model) continue;
            const ts = raw.timestamp;
            if (!ts) continue;
            const date = new Date(ts);
            if (date < cutoff) continue;

            const day = date.getDay();
            const hour = date.getHours();
            const key = `${day}-${hour}`;

            const u = raw.message.usage;
            const usage: TokenUsage = {
              inputTokens: u.input_tokens || 0,
              outputTokens: u.output_tokens || 0,
              cacheCreationTokens: u.cache_creation_input_tokens || 0,
              cacheReadTokens: u.cache_read_input_tokens || 0,
            };
            const cacheDetail = u.cache_creation;
            const detailed = cacheDetail
              ? {
                  cacheWrite5m: cacheDetail.ephemeral_5m_input_tokens || 0,
                  cacheWrite1h: cacheDetail.ephemeral_1h_input_tokens || 0,
                }
              : undefined;

            const cost = calculateCost(raw.message.model, usage, detailed);
            const tokens =
              usage.inputTokens +
              usage.outputTokens +
              usage.cacheCreationTokens +
              usage.cacheReadTokens;

            const cell = grid.get(key) ?? { day, hour, cost: 0, sessions: 0, tokens: 0 };
            cell.cost += cost;
            cell.tokens += tokens;
            grid.set(key, cell);

            const sb = sessionBuckets.get(key) ?? new Set<string>();
            sb.add(session.id);
            sessionBuckets.set(key, sb);
          } catch {
            continue;
          }
        }
      } catch {
        continue;
      }
    }
  }

  for (const [key, cell] of grid.entries()) {
    cell.sessions = sessionBuckets.get(key)?.size ?? 0;
  }

  return NextResponse.json(Array.from(grid.values()));
}
