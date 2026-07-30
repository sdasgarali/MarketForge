/**
 * ElevenLabsVoiceAdapter — TTS via the ElevenLabs REST API. When
 * `withSubtitles` is set it calls the `with-timestamps` endpoint, which returns
 * base64 audio plus per-character alignment; we convert that alignment into an
 * SRT subtitle string (no separate STT needed, ADR-007). Otherwise it calls the
 * plain TTS endpoint and returns base64 audio. Cost is estimated per character
 * via the pricing table. The API key is sent via the `xi-api-key` header and is
 * never logged.
 */
import { httpFetch, httpJson } from '../http.js';
import type { VoiceAdapter, VoiceGenerateOptions } from '../../interfaces/voice.js';
import type { GeneratedVoice } from '../../interfaces/types.js';
import { AdapterError } from '../../errors.js';
import { voiceCostUsd } from '../pricing.js';
import { alignmentToSrt, type ElevenAlignment } from './subtitles.js';

const API_BASE = 'https://api.elevenlabs.io/v1';
const DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb'; // ElevenLabs stock voice ("George")
const DEFAULT_MODEL = 'eleven_multilingual_v2';

interface WithTimestampsResponse {
  audio_base64: string;
  alignment?: ElevenAlignment;
  normalized_alignment?: ElevenAlignment;
}

export interface ElevenLabsAdapterOptions {
  apiKey: string;
  timeoutMs?: number;
  outputFormat?: string; // e.g. 'mp3_44100_128'
}

export class ElevenLabsVoiceAdapter implements VoiceAdapter {
  readonly name = 'elevenlabs';
  private readonly apiKey: string;
  private readonly timeoutMs: number;
  private readonly outputFormat: string;

  constructor(opts: ElevenLabsAdapterOptions) {
    if (!opts.apiKey) throw new AdapterError('ELEVENLABS_API_KEY missing', this.name);
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? 120_000;
    this.outputFormat = opts.outputFormat ?? 'mp3_44100_128';
  }

  private headers(): Record<string, string> {
    return { 'xi-api-key': this.apiKey, 'content-type': 'application/json' };
  }

  async generateVoice(opts: VoiceGenerateOptions): Promise<GeneratedVoice> {
    const voiceId = opts.voiceId ?? DEFAULT_VOICE_ID;
    const model = opts.modelHint ?? DEFAULT_MODEL;
    const started = Date.now();
    const body = JSON.stringify({ text: opts.text, model_id: model });
    const query = `?output_format=${encodeURIComponent(this.outputFormat)}`;
    const usageBase = {
      tokens_in: 0,
      tokens_out: 0,
      cost_usd: voiceCostUsd(opts.text.length),
      model,
      provider: this.name,
    };

    try {
      if (opts.withSubtitles) {
        const url = `${API_BASE}/text-to-speech/${voiceId}/with-timestamps${query}`;
        const json = await httpJson<WithTimestampsResponse>(
          url,
          { method: 'POST', headers: this.headers(), body },
          { provider: this.name, timeoutMs: this.timeoutMs, retries: 3 },
        );
        const alignment = json.normalized_alignment ?? json.alignment;
        const srt = alignment ? alignmentToSrt(alignment) : undefined;
        const durationMs = alignment ? endMs(alignment) : 0;
        const out: GeneratedVoice = {
          b64: json.audio_base64,
          durationMs,
          usage: { ...usageBase, latency_ms: Date.now() - started },
        };
        if (srt) out.subtitles = srt;
        return out;
      }

      // Plain TTS → binary audio.
      const url = `${API_BASE}/text-to-speech/${voiceId}${query}`;
      const res = await httpFetch(
        url,
        { method: 'POST', headers: this.headers(), body },
        { provider: this.name, timeoutMs: this.timeoutMs, retries: 3 },
      );
      if (!res.ok) {
        throw new AdapterError(`ElevenLabs TTS HTTP ${res.status}`, this.name);
      }
      const buf = Buffer.from(await res.arrayBuffer());
      return {
        b64: buf.toString('base64'),
        durationMs: 0, // unknown without alignment; caller may probe the audio
        usage: { ...usageBase, latency_ms: Date.now() - started },
      };
    } catch (err) {
      if (err instanceof AdapterError) throw err;
      throw new AdapterError('ElevenLabs generateVoice failed', this.name, err);
    }
  }
}

function endMs(a: ElevenAlignment): number {
  const ends = a.character_end_times_seconds;
  const last = ends.length ? ends[ends.length - 1] : 0;
  return Math.round((last ?? 0) * 1000);
}
