import { describe, it, expect } from 'vitest';
import { planChain, providerForModelHint, RoutingLlmAdapter } from './routing.js';
import type { ProviderKey } from './models.js';
import type { LlmAdapter, LlmGenerateOptions } from '../../interfaces/llm.js';
import type { GeneratedText } from '../../interfaces/types.js';

const set = (...p: ProviderKey[]): ReadonlySet<ProviderKey> => new Set(p);

describe('planChain — task-based selection', () => {
  it('routes copywriting to anthropic first', () => {
    const chain = planChain('copywriting', undefined, set('anthropic', 'gemini', 'groq'));
    expect(chain[0]).toBe('anthropic');
  });

  it('routes review/reasoning to anthropic first', () => {
    expect(planChain('review', undefined, set('anthropic', 'openai'))[0]).toBe('anthropic');
    expect(planChain('reasoning', undefined, set('gemini', 'anthropic'))[0]).toBe('anthropic');
  });

  it('routes bulk_tags to a cheap provider (gemini/groq) first', () => {
    expect(planChain('bulk_tags', undefined, set('anthropic', 'gemini', 'groq'))[0]).toBe('gemini');
    expect(planChain('bulk_tags', undefined, set('anthropic', 'groq'))[0]).toBe('groq');
  });

  it('defaults to copywriting order when task is undefined', () => {
    expect(planChain(undefined, undefined, set('anthropic', 'openai'))[0]).toBe('anthropic');
  });

  it('filters unavailable providers out of the chain', () => {
    const chain = planChain('copywriting', undefined, set('groq'));
    expect(chain).toEqual(['groq']);
  });

  it('returns empty chain when nothing is available', () => {
    expect(planChain('copywriting', undefined, set())).toEqual([]);
  });
});

describe('planChain — modelHint override', () => {
  it('moves the hinted provider to the front when available', () => {
    const chain = planChain('copywriting', 'gemini-2.5-pro', set('anthropic', 'gemini'));
    expect(chain[0]).toBe('gemini');
    expect(chain).toContain('anthropic'); // fallback preserved
  });

  it('ignores hint when the hinted provider is not available', () => {
    const chain = planChain('copywriting', 'gemini-2.5-pro', set('anthropic'));
    expect(chain[0]).toBe('anthropic');
  });
});

describe('providerForModelHint', () => {
  it('maps model families to providers', () => {
    expect(providerForModelHint('claude-opus-4-8')).toBe('anthropic');
    expect(providerForModelHint('gpt-5')).toBe('openai');
    expect(providerForModelHint('gemini-2.5-flash-lite')).toBe('gemini');
    expect(providerForModelHint('llama-3.3-70b-versatile')).toBe('groq');
    expect(providerForModelHint('meta/llama-3.3-70b-instruct')).toBe('nvidia');
    expect(providerForModelHint('deepseek-ai/deepseek-r1')).toBe('nvidia');
    expect(providerForModelHint('some-vendor/model-x')).toBe('openrouter');
    expect(providerForModelHint('something-unknown')).toBeUndefined();
  });
});

// --- Integration of the routing with fake adapters (fallback behaviour) ---

class FakeLlm implements LlmAdapter {
  calls = 0;
  constructor(
    readonly name: string,
    private readonly behaviour: 'ok' | 'fail',
  ) {}
  async generateText(_opts: LlmGenerateOptions): Promise<GeneratedText> {
    this.calls++;
    if (this.behaviour === 'fail') throw new Error(`${this.name} down`);
    return {
      text: `${this.name}-ok`,
      usage: { tokens_in: 1, tokens_out: 1, cost_usd: 0, latency_ms: 0, model: this.name },
    };
  }
}

describe('RoutingLlmAdapter — fallback chain', () => {
  it('falls back to the next provider when the first fails', async () => {
    const anthropic = new FakeLlm('anthropic', 'fail');
    const gemini = new FakeLlm('gemini', 'ok');
    const router = new RoutingLlmAdapter({ anthropic, gemini });
    const res = await router.generateText({ prompt: 'hi', task: 'copywriting' });
    expect(res.text).toBe('gemini-ok');
    expect(anthropic.calls).toBe(1);
    expect(gemini.calls).toBe(1);
  });

  it('throws when every provider in the chain fails', async () => {
    const anthropic = new FakeLlm('anthropic', 'fail');
    const gemini = new FakeLlm('gemini', 'fail');
    const router = new RoutingLlmAdapter({ anthropic, gemini });
    await expect(router.generateText({ prompt: 'hi', task: 'copywriting' })).rejects.toThrow(
      /All .* provider/,
    );
  });

  it('requires at least one provider', () => {
    expect(() => new RoutingLlmAdapter({})).toThrow(/at least one provider/);
  });

  it('exposes availableProviders', () => {
    const router = new RoutingLlmAdapter({ groq: new FakeLlm('groq', 'ok') });
    expect(router.availableProviders).toEqual(['groq']);
  });
});
