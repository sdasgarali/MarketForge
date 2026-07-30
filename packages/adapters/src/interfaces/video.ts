import type { GeneratedVideo } from './types.js';

export interface VideoGenerateOptions {
  prompt: string;
  durationS?: number;        // gens cap ~5-10s; stitch upstream
  withAudio?: boolean;
  modelHint?: string;        // 'veo' | 'runway' | 'kling' (via fal) | ...
  referenceImageKey?: string;
}

export interface VideoAdapter {
  readonly name: string;
  // Kling integrates via fal.ai queue API, NOT native (ADR-007).
  generateVideo(opts: VideoGenerateOptions): Promise<GeneratedVideo>;
}
