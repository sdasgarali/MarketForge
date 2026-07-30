/**
 * GeminiLlmAdapter — Google Gemini via @google/generative-ai. The workhorse for
 * cheap bulk tasks (tags/hashtags/summaries) using Flash-Lite (ADR-007). Cost
 * from usage metadata via the pricing table.
 */
import { GoogleGenerativeAI } from '@google/generative-ai';

import type { LlmAdapter, LlmGenerateOptions } from '../../interfaces/llm.js';
import type { GeneratedText } from '../../interfaces/types.js';
import { AdapterError } from '../../errors.js';
import { llmCostUsd } from '../pricing.js';
import { GEMINI_MODELS } from './models.js';

export interface GeminiAdapterOptions {
  apiKey: string;
}

export class GeminiLlmAdapter implements LlmAdapter {
  readonly name = 'gemini';
  private readonly client: GoogleGenerativeAI;

  constructor(opts: GeminiAdapterOptions) {
    if (!opts.apiKey) throw new AdapterError('GEMINI_API_KEY missing', this.name);
    this.client = new GoogleGenerativeAI(opts.apiKey);
  }

  async generateText(opts: LlmGenerateOptions): Promise<GeneratedText> {
    const model = opts.modelHint ?? GEMINI_MODELS.flashLite;
    const started = Date.now();
    const systemInstruction = [opts.brandPrefix, opts.system].filter(Boolean).join('\n\n');

    try {
      const gen = this.client.getGenerativeModel({
        model,
        ...(systemInstruction ? { systemInstruction } : {}),
        generationConfig: {
          maxOutputTokens: opts.maxTokens ?? 2048,
          temperature: opts.temperature ?? 0.7,
        },
      });
      const res = await gen.generateContent(opts.prompt);
      const text = res.response.text();
      const meta = res.response.usageMetadata;
      const tokensIn = meta?.promptTokenCount ?? 0;
      const tokensOut = meta?.candidatesTokenCount ?? 0;
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
      throw new AdapterError(`Gemini generateText failed (${model})`, this.name, err);
    }
  }
}
