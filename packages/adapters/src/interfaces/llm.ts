import type { LlmTask } from '@marketforge/contracts';
import type { GeneratedText } from './types.js';

export interface LlmGenerateOptions {
  prompt: string;
  system?: string;
  task?: LlmTask;            // routing hint: copywriting|review|reasoning|bulk_tags|summarize|research
  maxTokens?: number;
  temperature?: number;
  modelHint?: string;        // force a specific model, else router decides by task+cost
  brandPrefix?: string;      // for prompt caching by brand
}

export interface LlmAdapter {
  readonly name: string;
  generateText(opts: LlmGenerateOptions): Promise<GeneratedText>;
}
