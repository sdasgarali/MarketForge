/**
 * Canonical model ids per provider tier + default-by-task mapping used by the
 * routing adapter (ADR-007). Centralised so pricing keys and wire model ids
 * stay in lockstep with `pricing.ts`.
 */
import type { LlmTask } from '@marketforge/contracts';

export const ANTHROPIC_MODELS = {
  sonnet: 'claude-sonnet-4-6',
  opus: 'claude-opus-4-8',
  haiku: 'claude-haiku-4-5',
} as const;

export const OPENAI_MODELS = {
  default: 'gpt-5',
  mini: 'gpt-5-mini',
} as const;

export const GEMINI_MODELS = {
  flash: 'gemini-2.5-flash',
  flashLite: 'gemini-2.5-flash-lite',
  pro: 'gemini-2.5-pro',
} as const;

export const GROQ_MODELS = {
  versatile: 'llama-3.3-70b-versatile',
  instant: 'llama-3.1-8b-instant',
} as const;

export const OPENROUTER_MODELS = {
  auto: 'openrouter/auto',
} as const;

/** NVIDIA NIM (build.nvidia.com) — OpenAI-compatible, free tier for testing. */
export const NVIDIA_MODELS = {
  default: 'meta/llama-3.3-70b-instruct',
  nemotron: 'nvidia/llama-3.1-nemotron-70b-instruct',
  deepseek: 'deepseek-ai/deepseek-r1',
} as const;

export const NVIDIA_BASE_URL = 'https://integrate.api.nvidia.com/v1';

/** Which logical provider a task prefers, in ADR-007 order. */
export type ProviderKey =
  | 'anthropic'
  | 'gemini'
  | 'groq'
  | 'openai'
  | 'openrouter'
  | 'nvidia';

/**
 * Task → ordered provider preference. First available provider wins; the rest
 * form the fallback chain. Copywriting/review/reasoning → Claude tiers; bulk
 * tags/summarize → cheap Gemini Flash-Lite / Groq; research → capable+cheap.
 */
export const TASK_PROVIDER_ORDER: Record<LlmTask, ProviderKey[]> = {
  copywriting: ['anthropic', 'openai', 'gemini', 'openrouter', 'groq', 'nvidia'],
  review: ['anthropic', 'openai', 'gemini', 'openrouter', 'nvidia'],
  reasoning: ['anthropic', 'openai', 'gemini', 'openrouter', 'nvidia'],
  bulk_tags: ['gemini', 'groq', 'openai', 'anthropic', 'openrouter', 'nvidia'],
  summarize: ['gemini', 'groq', 'openai', 'anthropic', 'openrouter', 'nvidia'],
  research: ['gemini', 'anthropic', 'openai', 'openrouter', 'groq', 'nvidia'],
};

/** Default when no task is supplied. */
export const DEFAULT_TASK: LlmTask = 'copywriting';
