// Anthropic pricing per million tokens (as of March 2026)
// https://www.anthropic.com/pricing

export interface ModelPricing {
  inputPerMTok: number;
  outputPerMTok: number;
  cacheWrite5mPerMTok: number;  // 1.25x input
  cacheWrite1hPerMTok: number;  // 2x input
  cacheReadPerMTok: number;     // 0.1x input
}

export const MODEL_PRICING: Record<string, ModelPricing> = {
  // Opus 4.6 / 4.5
  "claude-opus-4-6": {
    inputPerMTok: 5,
    outputPerMTok: 25,
    cacheWrite5mPerMTok: 6.25,
    cacheWrite1hPerMTok: 10,
    cacheReadPerMTok: 0.5,
  },
  // Sonnet 4.6 / 4.5
  "claude-sonnet-4-6": {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheWrite5mPerMTok: 3.75,
    cacheWrite1hPerMTok: 6,
    cacheReadPerMTok: 0.3,
  },
  // Haiku 4.5
  "claude-haiku-4-5-20251001": {
    inputPerMTok: 1,
    outputPerMTok: 5,
    cacheWrite5mPerMTok: 1.25,
    cacheWrite1hPerMTok: 2,
    cacheReadPerMTok: 0.1,
  },
  // Opus 4.0 (2025-05-14)
  "claude-opus-4-20250514": {
    inputPerMTok: 5,
    outputPerMTok: 25,
    cacheWrite5mPerMTok: 6.25,
    cacheWrite1hPerMTok: 10,
    cacheReadPerMTok: 0.5,
  },
  // Legacy: Sonnet 4.5/4.0
  "claude-sonnet-4-5-20250514": {
    inputPerMTok: 3,
    outputPerMTok: 15,
    cacheWrite5mPerMTok: 3.75,
    cacheWrite1hPerMTok: 6,
    cacheReadPerMTok: 0.3,
  },
  // Legacy: Haiku 3.5
  "claude-haiku-3-5-20241022": {
    inputPerMTok: 0.8,
    outputPerMTok: 4,
    cacheWrite5mPerMTok: 1,
    cacheWrite1hPerMTok: 1.6,
    cacheReadPerMTok: 0.08,
  },
};

const DEFAULT_PRICING: ModelPricing = MODEL_PRICING["claude-sonnet-4-6"];

export function getPricing(model: string): ModelPricing {
  if (MODEL_PRICING[model]) return MODEL_PRICING[model];

  // Prefix matching — newest models first
  if (model.includes("opus-4-6") || model.includes("opus-4-5")) return MODEL_PRICING["claude-opus-4-6"];
  if (model.includes("opus")) return MODEL_PRICING["claude-opus-4-20250514"]; // legacy opus
  if (model.includes("haiku-4-5")) return MODEL_PRICING["claude-haiku-4-5-20251001"];
  if (model.includes("haiku")) return MODEL_PRICING["claude-haiku-3-5-20241022"];
  if (model.includes("sonnet")) return MODEL_PRICING["claude-sonnet-4-6"];

  return DEFAULT_PRICING;
}

export interface TokenUsage {
  inputTokens: number;
  outputTokens: number;
  cacheCreationTokens: number;
  cacheReadTokens: number;
}

export interface DetailedTokenUsage extends TokenUsage {
  cacheWrite5mTokens: number;
  cacheWrite1hTokens: number;
}

export function calculateCost(model: string, usage: TokenUsage, detailed?: { cacheWrite5m: number; cacheWrite1h: number }): number {
  const pricing = getPricing(model);

  let cacheWriteCost: number;
  if (detailed) {
    // Use detailed breakdown if available
    cacheWriteCost =
      (detailed.cacheWrite5m / 1_000_000) * pricing.cacheWrite5mPerMTok +
      (detailed.cacheWrite1h / 1_000_000) * pricing.cacheWrite1hPerMTok;
  } else {
    // Fallback: assume all cache writes are 5-min (most common in Claude Code)
    cacheWriteCost = (usage.cacheCreationTokens / 1_000_000) * pricing.cacheWrite5mPerMTok;
  }

  const cost =
    (usage.inputTokens / 1_000_000) * pricing.inputPerMTok +
    (usage.outputTokens / 1_000_000) * pricing.outputPerMTok +
    cacheWriteCost +
    (usage.cacheReadTokens / 1_000_000) * pricing.cacheReadPerMTok;

  return cost;
}

export function getModelDisplayName(model: string): string {
  // Strip provider prefix if present (e.g. "claude-sonnet-4-6@default" → "claude-sonnet-4-6")
  const base = model.includes("@") ? model.split("@")[0] : model;
  if (base.includes("opus")) return "Opus";
  if (base.includes("sonnet")) return "Sonnet";
  if (base.includes("haiku")) return "Haiku";
  if (base.includes("gpt-4")) return "GPT-4";
  if (base.includes("gpt-3")) return "GPT-3.5";
  if (base.includes("gemini")) return "Gemini";
  if (base.includes("llama")) return "Llama";
  if (base.includes("deepseek")) return "DeepSeek";
  if (base.includes("mistral")) return "Mistral";
  if (base.includes("qwen")) return "Qwen";
  if (base.includes("glm")) return "GLM";
  return base.split("-").slice(0, 3).join("-") || model;
}

export function getModelColor(model: string): string {
  if (model.includes("opus")) return "#a78bfa";
  if (model.includes("sonnet")) return "#60a5fa";
  if (model.includes("haiku")) return "#4ade80";
  return "#8888a4";
}
