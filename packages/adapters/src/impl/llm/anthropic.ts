/**
 * AnthropicLlmAdapter — Claude via the official @anthropic-ai/sdk.
 *
 * Model tiering (ADR-007): copywriting/default → Sonnet 4.6; review/reasoning
 * → Opus 4.8. `brandPrefix` (a per-brand system preamble) is sent as a cached
 * system block (prompt caching) so repeated brand context is billed at the
 * cheaper cached-read rate. Cost is computed from real token usage via the
 * central pricing table. The SDK carries its own timeout + retries; we set them
 * explicitly and never log the API key or prompt content.
 */
import Anthropic from '@anthropic-ai/sdk';
import type { LlmTask } from '@marketforge/contracts';

import type { LlmAdapter, LlmGenerateOptions } from '../../interfaces/llm.js';
import type { GeneratedText } from '../../interfaces/types.js';
import { AdapterError } from '../../errors.js';
import { llmCostUsd } from '../pricing.js';
import { ANTHROPIC_MODELS } from './models.js';

const REASONING_TASKS = new Set<LlmTask>(['review', 'reasoning']);

export interface AnthropicAdapterOptions {
  apiKey: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export class AnthropicLlmAdapter implements LlmAdapter {
  readonly name = 'anthropic';
  private readonly client: Anthropic;

  constructor(opts: AnthropicAdapterOptions) {
    if (!opts.apiKey) throw new AdapterError('ANTHROPIC_API_KEY missing', this.name);
    this.client = new Anthropic({
      apiKey: opts.apiKey,
      timeout: opts.timeoutMs ?? 120_000,
      maxRetries: opts.maxRetries ?? 2,
    });
  }

  /** Pick a Claude tier from task/modelHint. */
  private resolveModel(opts: LlmGenerateOptions): string {
    if (opts.modelHint) return opts.modelHint;
    if (opts.task && REASONING_TASKS.has(opts.task)) return ANTHROPIC_MODELS.opus;
    return ANTHROPIC_MODELS.sonnet;
  }

  async generateText(opts: LlmGenerateOptions): Promise<GeneratedText> {
    const model = this.resolveModel(opts);
    const started = Date.now();

    // Build system as cacheable blocks: brandPrefix (stable, cached) first,
    // then the per-call system instruction (not cached).
    const system: Anthropic.TextBlockParam[] = [];
    if (opts.brandPrefix) {
      system.push({
        type: 'text',
        text: opts.brandPrefix,
        cache_control: { type: 'ephemeral' },
      });
    }
    if (opts.system) {
      system.push({ type: 'text', text: opts.system });
    }

    try {
      const res = await this.client.messages.create({
        model,
        max_tokens: opts.maxTokens ?? 2048,
        temperature: opts.temperature ?? 0.7,
        ...(system.length ? { system } : {}),
        messages: [{ role: 'user', content: opts.prompt }],
      });

      const text = res.content
        .filter((b): b is Anthropic.TextBlock => b.type === 'text')
        .map((b) => b.text)
        .join('');

      const u = res.usage;
      const cachedIn = u.cache_read_input_tokens ?? 0;
      const cacheWrite = u.cache_creation_input_tokens ?? 0;
      const tokensIn = (u.input_tokens ?? 0) + cachedIn + cacheWrite;
      const tokensOut = u.output_tokens ?? 0;

      return {
        text,
        usage: {
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          cost_usd: llmCostUsd(model, { tokensIn, tokensOut, cachedIn, cacheWrite }),
          latency_ms: Date.now() - started,
          model,
          provider: this.name,
        },
      };
    } catch (err) {
      throw new AdapterError(`Anthropic generateText failed (${model})`, this.name, err);
    }
  }
}
