// STUB — replace with real impl in src/impl/<name>.ts (owned by another agent).
//
// Real backend: Anthropic (Claude Sonnet for copywriting, Opus for review/
// reasoning) + Gemini Flash-Lite / Groq for bulk tags, behind a task+cost
// router (ADR-007). MCP: none for LLM — direct SDK calls.
//
// This stub echoes the prompt back with a zero-cost Usage so downstream dev
// flows (agents, pipelines) can run end-to-end without any real SDK installed.

import type { Usage } from '@marketforge/contracts';
import type { LlmAdapter, LlmGenerateOptions } from '../interfaces/llm.js';
import type { GeneratedText } from '../interfaces/types.js';

function zeroUsage(model: string): Usage {
  return {
    tokens_in: 0,
    tokens_out: 0,
    cost_usd: 0,
    latency_ms: 0,
    model,
    provider: 'stub',
  };
}

export class StubLlmAdapter implements LlmAdapter {
  readonly name = 'stub-llm';

  async generateText(opts: LlmGenerateOptions): Promise<GeneratedText> {
    // TODO(impl): route by opts.task/opts.modelHint to Anthropic/Gemini/Groq.
    const model = opts.modelHint ?? 'stub-echo';
    const label = opts.task ? `[${opts.task}] ` : '';
    return {
      text: `${label}STUB ECHO: ${opts.prompt}`,
      usage: zeroUsage(model),
    };
  }
}
