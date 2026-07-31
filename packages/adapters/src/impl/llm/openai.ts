/**
 * OpenAiLlmAdapter — thin adapter over the official `openai` SDK (Chat
 * Completions). Used mainly as a routing fallback. Cost from token usage via
 * the pricing table.
 */
import OpenAI from 'openai';

import type { LlmAdapter, LlmGenerateOptions } from '../../interfaces/llm.js';
import type { GeneratedText } from '../../interfaces/types.js';
import { AdapterError } from '../../errors.js';
import { llmCostUsd } from '../pricing.js';
import { OPENAI_MODELS } from './models.js';

export interface OpenAiAdapterOptions {
  apiKey: string;
  baseURL?: string;
  timeoutMs?: number;
  maxRetries?: number;
  /** Default model when no hint (used for OpenAI-compatible providers e.g. NVIDIA). */
  defaultModel?: string;
  /** Adapter/provider name override (e.g. 'nvidia'). */
  providerName?: string;
}

export class OpenAiLlmAdapter implements LlmAdapter {
  readonly name: string;
  private readonly client: OpenAI;
  private readonly defaultModel: string;

  constructor(opts: OpenAiAdapterOptions) {
    this.name = opts.providerName ?? 'openai';
    if (!opts.apiKey) throw new AdapterError(`${this.name} apiKey missing`, this.name);
    this.defaultModel = opts.defaultModel ?? OPENAI_MODELS.default;
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      ...(opts.baseURL ? { baseURL: opts.baseURL } : {}),
      timeout: opts.timeoutMs ?? 120_000,
      maxRetries: opts.maxRetries ?? 2,
    });
  }

  async generateText(opts: LlmGenerateOptions): Promise<GeneratedText> {
    const model = opts.modelHint ?? this.defaultModel;
    const started = Date.now();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    const sys = [opts.brandPrefix, opts.system].filter(Boolean).join('\n\n');
    if (sys) messages.push({ role: 'system', content: sys });
    messages.push({ role: 'user', content: opts.prompt });

    try {
      const res = await this.client.chat.completions.create({
        model,
        messages,
        max_completion_tokens: opts.maxTokens ?? 2048,
        temperature: opts.temperature ?? 0.7,
      });
      const text = res.choices[0]?.message?.content ?? '';
      const tokensIn = res.usage?.prompt_tokens ?? 0;
      const tokensOut = res.usage?.completion_tokens ?? 0;
      return {
        text,
        usage: {
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          cost_usd: llmCostUsd(model, { tokensIn, tokensOut }),
          latency_ms: Date.now() - started,
          model,
          provider: this.name,
        },
      };
    } catch (err) {
      throw new AdapterError(`OpenAI generateText failed (${model})`, this.name, err);
    }
  }
}
