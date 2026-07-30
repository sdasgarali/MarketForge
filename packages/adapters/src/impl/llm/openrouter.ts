/**
 * OpenRouterLlmAdapter — routes to many providers behind one OpenAI-compatible
 * endpoint. Thin: reuses the `openai` SDK pointed at OpenRouter's base URL. Used
 * as a last-resort fallback in the routing chain (broad model availability).
 */
import OpenAI from 'openai';

import type { LlmAdapter, LlmGenerateOptions } from '../../interfaces/llm.js';
import type { GeneratedText } from '../../interfaces/types.js';
import { AdapterError } from '../../errors.js';
import { llmCostUsd } from '../pricing.js';
import { OPENROUTER_MODELS } from './models.js';

const OPENROUTER_BASE_URL = 'https://openrouter.ai/api/v1';

export interface OpenRouterAdapterOptions {
  apiKey: string;
  timeoutMs?: number;
  maxRetries?: number;
  /** Optional attribution headers OpenRouter recommends. */
  referer?: string;
  title?: string;
}

export class OpenRouterLlmAdapter implements LlmAdapter {
  readonly name = 'openrouter';
  private readonly client: OpenAI;

  constructor(opts: OpenRouterAdapterOptions) {
    if (!opts.apiKey) throw new AdapterError('OPENROUTER_API_KEY missing', this.name);
    this.client = new OpenAI({
      apiKey: opts.apiKey,
      baseURL: OPENROUTER_BASE_URL,
      timeout: opts.timeoutMs ?? 120_000,
      maxRetries: opts.maxRetries ?? 2,
      defaultHeaders: {
        ...(opts.referer ? { 'HTTP-Referer': opts.referer } : {}),
        ...(opts.title ? { 'X-Title': opts.title } : {}),
      },
    });
  }

  async generateText(opts: LlmGenerateOptions): Promise<GeneratedText> {
    const model = opts.modelHint ?? OPENROUTER_MODELS.auto;
    const started = Date.now();

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
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
      // OpenRouter returns the actual routed model id; prefer it for pricing.
      const billedModel = res.model ?? model;
      return {
        text,
        usage: {
          tokens_in: tokensIn,
          tokens_out: tokensOut,
          cost_usd: llmCostUsd(billedModel, { tokensIn, tokensOut }),
          latency_ms: Date.now() - started,
          model: billedModel,
          provider: this.name,
        },
      };
    } catch (err) {
      throw new AdapterError(`OpenRouter generateText failed (${model})`, this.name, err);
    }
  }
}
