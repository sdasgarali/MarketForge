import { describe, it, expect } from 'vitest';
import {
  llmCostUsd,
  imageCostUsd,
  videoCostUsd,
  voiceCostUsd,
  LLM_PRICING,
} from './pricing.js';

describe('llmCostUsd', () => {
  it('computes cost from input + output tokens', () => {
    // Sonnet: $3/1M in, $15/1M out. 1M in + 1M out = 3 + 15 = 18.
    expect(llmCostUsd('claude-sonnet-4-6', { tokensIn: 1_000_000, tokensOut: 1_000_000 })).toBe(18);
  });

  it('bills cached-read input at the cheaper cached rate', () => {
    // Opus cachedIn 1.5/1M. 1M cached input, 0 output.
    const cost = llmCostUsd('claude-opus-4-8', {
      tokensIn: 1_000_000,
      tokensOut: 0,
      cachedIn: 1_000_000,
    });
    expect(cost).toBe(1.5);
  });

  it('splits uncached vs cached input correctly', () => {
    // Sonnet: 500k uncached @3/M = 1.5 ; 500k cached @0.3/M = 0.15 ; total 1.65
    const cost = llmCostUsd('claude-sonnet-4-6', {
      tokensIn: 1_000_000,
      tokensOut: 0,
      cachedIn: 500_000,
    });
    expect(cost).toBeCloseTo(1.65, 6);
  });

  it('adds cache-write cost', () => {
    // Sonnet cacheWrite 3.75/M. 1M write only.
    const cost = llmCostUsd('claude-sonnet-4-6', {
      tokensIn: 1_000_000,
      tokensOut: 0,
      cacheWrite: 1_000_000,
      cachedIn: 0,
    });
    // uncached input = 1M - 0 cached = 1M @3 = 3 ; + cacheWrite 3.75 = 6.75
    expect(cost).toBeCloseTo(6.75, 6);
  });

  it('falls back to a default price for unknown models (never throws)', () => {
    expect(() => llmCostUsd('totally-made-up', { tokensIn: 1000, tokensOut: 0 })).not.toThrow();
    expect(llmCostUsd('totally-made-up', { tokensIn: 1_000_000, tokensOut: 0 })).toBe(3);
  });

  it('has consistent pricing keys used by model tiers', () => {
    expect(LLM_PRICING['claude-sonnet-4-6']).toBeDefined();
    expect(LLM_PRICING['claude-opus-4-8']).toBeDefined();
    expect(LLM_PRICING['gemini-2.5-flash-lite']).toBeDefined();
  });
});

describe('media cost helpers', () => {
  it('imageCostUsd multiplies per-image price by count', () => {
    expect(imageCostUsd('fal-ai/ideogram/v3', 4)).toBeCloseTo(0.24, 6);
    expect(imageCostUsd('unknown-model', 2)).toBeCloseTo(0.06, 6); // default 0.03/img
  });

  it('videoCostUsd multiplies per-second price by duration', () => {
    // Kling via fal ~0.28/s (ADR-007). 5s = 1.4.
    expect(videoCostUsd('fal-ai/kling-video/v2/master/text-to-video', 5)).toBeCloseTo(1.4, 6);
  });

  it('voiceCostUsd bills per 1k characters', () => {
    expect(voiceCostUsd(1000)).toBeCloseTo(0.15, 6);
    expect(voiceCostUsd(0)).toBe(0);
  });
});
