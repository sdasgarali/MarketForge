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

/** Which logical provider a task prefers, in ADR-007 order. */
export type ProviderKey = 'anthropic' | 'gemini' | 'groq' | 'openai' | 'openrouter';

/**
 * Task → ordered provider preference. First available provider wins; the rest
 * form the fallback chain. Copywriting/review/reasoning → Claude tiers; bulk
 * tags/summarize → cheap Gemini Flash-Lite / Groq; research → capable+cheap.
 */
export const TASK_PROVIDER_ORDER: Record<LlmTask, ProviderKey[]> = {
  copywriting: ['anthropic', 'openai', 'gemini', 'openrouter', 'groq'],
  review: ['anthropic', 'openai', 'gemini', 'openrouter'],
  reasoning: ['anthropic', 'openai', 'gemini', 'openrouter'],
  bulk_tags: ['gemini', 'groq', 'openai', 'anthropic', 'openrouter'],
  summarize: ['gemini', 'groq', 'openai', 'anthropic', 'openrouter'],
  research: ['gemini', 'anthropic', 'openai', 'openrouter', 'groq'],
};

/** Default when no task is supplied. */
export const DEFAULT_TASK: LlmTask = 'copywriting';
