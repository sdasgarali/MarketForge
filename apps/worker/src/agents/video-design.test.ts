import { describe, expect, it } from 'vitest';
import { composeVideoPrompt } from './video-design.agent.js';

describe('composeVideoPrompt', () => {
  it('returns the base prompt unchanged when there is no design', () => {
    expect(composeVideoPrompt('A short brand video', {})).toBe('A short brand video');
  });

  it('appends characters and components as labelled sections', () => {
    const out = composeVideoPrompt('Base', {
      characters: 'A cheerful mascot',
      components: 'Neon city at night',
    });
    expect(out).toBe('Base\n\nCharacters: A cheerful mascot\n\nScene & components: Neon city at night');
  });

  it('ignores blank design fields and trims', () => {
    expect(composeVideoPrompt('  Base  ', { characters: '   ', components: 'Props: a laptop' })).toBe(
      'Base\n\nScene & components: Props: a laptop',
    );
  });
});
