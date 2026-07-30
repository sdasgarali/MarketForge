/**
 * Model pricing table (USD per 1,000,000 tokens) + cost calculators.
 *
 * Values are 2026 published list prices for the model tiers used by the
 * routing adapter (ADR-007). They are intentionally centralised here so cost
 * accounting is auditable and swappable without touching adapter logic. When a
 * model id is unknown, `costUsd` falls back to a conservative per-model default
 * and never throws (cost accounting must not break a generation).
 *
 * Sources: Anthropic, OpenAI, Google (Gemini), Groq, OpenRouter public pricing
 * pages as of 2026-07. Prompt-cache read/write multipliers per Anthropic docs
 * (cache write ≈ 1.25× input, cache read ≈ 0.1× input).
 */

export interface ModelPrice {
  /** USD per 1M input (prompt) tokens. */
  inPerM: number;
  /** USD per 1M output (completion) tokens. */
  outPerM: number;
  /** USD per 1M cached-input tokens read (prompt caching). Optional. */
  cachedInPerM?: number;
  /** USD per 1M tokens written to cache. Optional. */
  cacheWritePerM?: number;
}

/**
 * Canonical model ids → price. Keys are the exact provider model strings the
 * adapters send on the wire, so lookups are direct.
 */
export const LLM_PRICING: Record<string, ModelPrice> = {
  // --- Anthropic (Claude) ---
  'claude-sonnet-4-6': { inPerM: 3, outPerM: 15, cachedInPerM: 0.3, cacheWritePerM: 3.75 },
  'claude-opus-4-8': { inPerM: 15, outPerM: 75, cachedInPerM: 1.5, cacheWritePerM: 18.75 },
  'claude-haiku-4-5': { inPerM: 1, outPerM: 5, cachedInPerM: 0.1, cacheWritePerM: 1.25 },

  // --- OpenAI ---
  'gpt-5': { inPerM: 1.25, outPerM: 10 },
  'gpt-5-mini': { inPerM: 0.25, outPerM: 2 },
  'gpt-4.1': { inPerM: 2, outPerM: 8 },
  'gpt-4o-mini': { inPerM: 0.15, outPerM: 0.6 },

  // --- Google Gemini ---
  'gemini-2.5-flash': { inPerM: 0.3, outPerM: 2.5 },
  'gemini-2.5-flash-lite': { inPerM: 0.1, outPerM: 0.4 },
  'gemini-2.5-pro': { inPerM: 1.25, outPerM: 10 },

  // --- Groq (OSS models, very cheap; per-1M) ---
  'llama-3.3-70b-versatile': { inPerM: 0.59, outPerM: 0.79 },
  'llama-3.1-8b-instant': { inPerM: 0.05, outPerM: 0.08 },

  // --- OpenRouter (used as a routed fallback; price varies by underlying model) ---
  'openrouter/auto': { inPerM: 1, outPerM: 3 },
};

/** Conservative default when a model id is not in the table. */
const DEFAULT_PRICE: ModelPrice = { inPerM: 3, outPerM: 15 };

export interface TokenBreakdown {
  tokensIn: number;
  tokensOut: number;
  /** Cached-input tokens read (billed at the cheaper cached rate). */
  cachedIn?: number;
  /** Tokens written to cache this call (billed at the write rate). */
  cacheWrite?: number;
}

/**
 * Compute cost in USD for an LLM call. Uncached input is billed at `inPerM`,
 * cached-read input at `cachedInPerM`, cache writes at `cacheWritePerM`, and
 * output at `outPerM`. All token counts default to 0. Never throws.
 */
export function llmCostUsd(model: string, t: TokenBreakdown): number {
  const p = LLM_PRICING[model] ?? DEFAULT_PRICE;
  const cachedIn = t.cachedIn ?? 0;
  const cacheWrite = t.cacheWrite ?? 0;
  const uncachedIn = Math.max(0, (t.tokensIn ?? 0) - cachedIn);
  const cost =
    (uncachedIn / 1_000_000) * p.inPerM +
    (cachedIn / 1_000_000) * (p.cachedInPerM ?? p.inPerM) +
    (cacheWrite / 1_000_000) * (p.cacheWritePerM ?? p.inPerM) +
    ((t.tokensOut ?? 0) / 1_000_000) * p.outPerM;
  // Round to 6 decimals (sub-cent precision) to avoid FP noise in ledgers.
  return Math.round(cost * 1e6) / 1e6;
}

// --- Media pricing (flat per-unit; drives image/video/voice Usage.cost_usd) ---

/** USD per generated image, keyed by fal model id (2026 fal.ai list). */
export const IMAGE_PRICING: Record<string, number> = {
  'fal-ai/ideogram/v3': 0.06,
  'fal-ai/bytedance/seedream/v4/text-to-image': 0.03,
  'fal-ai/flux/dev': 0.025,
  'fal-ai/flux-pro/kontext': 0.04,
  'fal-ai/flux/schnell': 0.003,
};

/** Compute image cost: per-image price × count. Unknown model → 0.03/img. */
export function imageCostUsd(model: string, count: number): number {
  const per = IMAGE_PRICING[model] ?? 0.03;
  return Math.round(per * count * 1e6) / 1e6;
}

/** USD per second of generated video, keyed by fal model id (2026, ADR-007). */
export const VIDEO_PRICING_PER_SEC: Record<string, number> = {
  'fal-ai/kling-video/v2/master/text-to-video': 0.28, // ADR-007: ~$0.28/s via fal
  'fal-ai/kling-video/v2/master/image-to-video': 0.28,
  'fal-ai/veo3': 0.5,
  'fal-ai/runway-gen4/turbo': 0.4,
  'fal-ai/minimax/hailuo-02/standard/text-to-video': 0.045,
};

/** Compute video cost: per-second price × duration seconds. */
export function videoCostUsd(model: string, durationS: number): number {
  const per = VIDEO_PRICING_PER_SEC[model] ?? 0.3;
  return Math.round(per * durationS * 1e6) / 1e6;
}

/**
 * ElevenLabs is billed per character (credit) not per token. Approximate USD
 * per 1,000 characters on the Creator/Pro tiers (~$0.15/1k chars blended).
 */
export const VOICE_USD_PER_1K_CHARS = 0.15;

export function voiceCostUsd(chars: number): number {
  return Math.round((chars / 1000) * VOICE_USD_PER_1K_CHARS * 1e6) / 1e6;
}
