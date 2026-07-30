import type { GeneratedVoice } from './types.js';

export interface VoiceGenerateOptions { text: string; voiceId?: string; withSubtitles?: boolean; modelHint?: string; }

export interface VoiceAdapter {
  readonly name: string;
  generateVoice(opts: VoiceGenerateOptions): Promise<GeneratedVoice>;
}
