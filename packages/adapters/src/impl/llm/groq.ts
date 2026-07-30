/**
 * GroqLlmAdapter — ultra-cheap, fast OSS models via the `groq-sdk` (OpenAI-
 * compatible chat API). Used for batched bulk tags/hashtags as a Gemini
 * alternative (ADR-007). Cost from token usage via the pricing table.
 */
import Groq from 'groq-sdk';

import type { LlmAdapter, LlmGenerateOptions } from '../../interfaces/llm.js';
import type { GeneratedText } from '../../interfaces/types.js';
import { AdapterError } from '../../errors.js';
import { llmCostUsd } from '../pricing.js';
import { GROQ_MODELS } from './models.js';

export interface GroqAdapterOptions {
  apiKey: string;
  timeoutMs?: number;
  maxRetries?: number;
}

export class GroqLlmAdapter implements LlmAdapter {
  readonly name = 'groq';
  private readonly client: Groq;

  constructor(opts: GroqAdapterOptions) {
    if (!opts.apiKey) throw new AdapterError('GROQ_API_KEY missing', this.name);
    this.client = new Groq({
      apiKey: opts.apiKey,
      timeout: opts.timeoutMs ?? 60_000,
      maxRetries: opts.maxRetries ?? 2,
    });
  }

  async generateText(opts: LlmGenerateOptions): Promise<GeneratedText> {
    const model = opts.modelHint ?? GROQ_MODELS.versatile;
    const started = Date.now();

    const messages: Groq.Chat.ChatCompletionMessageParam[] = [];
    const sys = [opts.brandPrefix, opts.system].filter(Boolean).join('\n\n');
    if (sys) messages.push({ role: 'system', content: sys });
    messages.push({ role: 'user', content: opts.prompt });

    try {
      const res = await this.client.chat.completions.create({
        model,
        messages,
        max_tokens: opts.maxTokens ?? 2048,
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
      throw new AdapterError(`Groq generateText failed (${model})`, this.name, err);
    }
  }
}
