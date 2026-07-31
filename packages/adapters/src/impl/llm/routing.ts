/**
 * RoutingLlmAdapter — the default `llm` (ADR-007). Given a set of available
 * concrete provider adapters, it:
 *   1. Picks an ordered provider chain by `task` (copywriting → Anthropic;
 *      review/reasoning → Anthropic Opus; bulk_tags/summarize → Gemini/Groq;
 *      research → Gemini/Anthropic), intersected with providers that are
 *      actually configured.
 *   2. If `modelHint` is set, honours it: if the hint maps to a known provider
 *      prefix, that provider is tried first (hint passed through so the concrete
 *      adapter forces the exact model).
 *   3. Tries each provider in order; on error/rate-limit it falls through to the
 *      next (fallback chain). Only if all fail does it throw AdapterError.
 *
 * The provider-selection logic (`planChain`) is pure and unit-tested without any
 * network calls.
 */
import type { LlmTask } from '@marketforge/contracts';

import type { LlmAdapter, LlmGenerateOptions } from '../../interfaces/llm.js';
import type { GeneratedText } from '../../interfaces/types.js';
import { AdapterError } from '../../errors.js';
import { TASK_PROVIDER_ORDER, DEFAULT_TASK, type ProviderKey } from './models.js';

/** Map a model-id / hint to the provider that serves it (best-effort by prefix). */
export function providerForModelHint(hint: string): ProviderKey | undefined {
  const h = hint.toLowerCase();
  if (h.startsWith('claude') || h.startsWith('anthropic')) return 'anthropic';
  if (h.startsWith('gpt') || h.startsWith('o1') || h.startsWith('o3') || h.startsWith('openai'))
    return 'openai';
  if (h.startsWith('gemini') || h.startsWith('google')) return 'gemini';
  if (
    h.startsWith('nvidia/') ||
    h.startsWith('meta/') ||
    h.startsWith('deepseek-ai/') ||
    h.includes('nemotron')
  )
    return 'nvidia';
  if (h.startsWith('llama') || h.startsWith('groq') || h.includes('groq')) return 'groq';
  if (h.startsWith('openrouter') || h.includes('/')) return 'openrouter';
  return undefined;
}

/**
 * Pure planning function: given the task, an optional modelHint, and the set of
 * available provider keys, return the ordered chain of providers to try.
 * Exported for unit testing.
 */
export function planChain(
  task: LlmTask | undefined,
  modelHint: string | undefined,
  available: ReadonlySet<ProviderKey>,
): ProviderKey[] {
  const order = TASK_PROVIDER_ORDER[task ?? DEFAULT_TASK];
  // Base chain: task order filtered to available providers.
  const chain = order.filter((p) => available.has(p));

  if (modelHint) {
    const hinted = providerForModelHint(modelHint);
    if (hinted && available.has(hinted)) {
      // Move the hinted provider to the front (dedup), keep the rest as fallback.
      return [hinted, ...chain.filter((p) => p !== hinted)];
    }
  }
  return chain;
}

export interface RoutingProviders {
  anthropic?: LlmAdapter;
  openai?: LlmAdapter;
  gemini?: LlmAdapter;
  groq?: LlmAdapter;
  openrouter?: LlmAdapter;
  nvidia?: LlmAdapter;
}

export class RoutingLlmAdapter implements LlmAdapter {
  readonly name = 'routing-llm';
  private readonly providers: RoutingProviders;
  private readonly available: Set<ProviderKey>;

  constructor(providers: RoutingProviders) {
    this.providers = providers;
    this.available = new Set(
      (Object.keys(providers) as ProviderKey[]).filter((k) => Boolean(providers[k])),
    );
    if (this.available.size === 0) {
      throw new AdapterError('RoutingLlmAdapter needs at least one provider', this.name);
    }
  }

  /** Providers currently wired (for logging/introspection). */
  get availableProviders(): ProviderKey[] {
    return [...this.available];
  }

  async generateText(opts: LlmGenerateOptions): Promise<GeneratedText> {
    const chain = planChain(opts.task, opts.modelHint, this.available);
    if (chain.length === 0) {
      throw new AdapterError(
        `No available provider for task=${opts.task ?? DEFAULT_TASK}`,
        this.name,
      );
    }

    const errors: Array<{ provider: ProviderKey; error: unknown }> = [];
    for (const key of chain) {
      const adapter = this.providers[key];
      if (!adapter) continue;
      try {
        // Pass modelHint through only when it targets THIS provider; otherwise
        // let the concrete adapter choose its task-appropriate default model.
        const hintProvider = opts.modelHint ? providerForModelHint(opts.modelHint) : undefined;
        const forwardHint = hintProvider === key ? opts.modelHint : undefined;
        const callOpts: LlmGenerateOptions = forwardHint
          ? { ...opts, modelHint: forwardHint }
          : { ...opts, modelHint: undefined };
        return await adapter.generateText(callOpts);
      } catch (err) {
        errors.push({ provider: key, error: err });
        // Fall through to the next provider in the chain.
      }
    }

    throw new AdapterError(
      `All ${chain.length} provider(s) failed for task=${opts.task ?? DEFAULT_TASK}: ${chain.join(
        ' → ',
      )}`,
      this.name,
      errors,
    );
  }
}
