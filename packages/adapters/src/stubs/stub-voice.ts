// STUB — replace with real impl in src/impl/<name>.ts (owned by another agent).
//
// Real backend: ElevenLabs (ADR-007). MCP server: `elevenlabs`. Optional
// alternative: Suno (MCP `suno`) for music/jingles.
//
// This stub returns a clearly-marked placeholder voice track (stub:// url) with
// a zero-cost Usage instead of throwing, so a downstream dev run does not crash.

import type { Usage } from '@marketforge/contracts';
import type { VoiceAdapter, VoiceGenerateOptions } from '../interfaces/voice.js';
import type { GeneratedVoice } from '../interfaces/types.js';

function zeroUsage(model: string): Usage {
  return { tokens_in: 0, tokens_out: 0, cost_usd: 0, latency_ms: 0, model, provider: 'stub' };
}

export class StubVoiceAdapter implements VoiceAdapter {
  readonly name = 'stub-voice';

  async generateVoice(opts: VoiceGenerateOptions): Promise<GeneratedVoice> {
    // TODO(impl): call ElevenLabs TTS; upload audio to storage, set storageKey.
    const model = opts.modelHint ?? 'stub-elevenlabs';
    const voice = opts.voiceId ?? 'default';
    // Rough duration estimate: ~15 chars/sec of speech.
    const durationMs = Math.max(1000, Math.round((opts.text.length / 15) * 1000));
    const base: GeneratedVoice = {
      url: `stub://voice/${voice}`,
      durationMs,
      usage: zeroUsage(model),
    };
    if (opts.withSubtitles) {
      base.subtitles = `1\n00:00:00,000 --> 00:00:05,000\n${opts.text.slice(0, 120)}\n`;
    }
    return base;
  }
}
