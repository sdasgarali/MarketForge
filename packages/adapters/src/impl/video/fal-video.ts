/**
 * FalVideoAdapter — text/image-to-video via fal.ai's queue API (Phase 3,
 * gated). Per ADR-007, Kling is integrated **via fal's queue API, NOT Kling's
 * native API**. Veo / Runway / Hailuo are selectable by `modelHint`.
 *
 * All these models cap at ~5–10s per generation; longer content is produced by
 * stitching segments upstream. Only Veo/Runway/Kling carry native audio, so
 * `withAudio` is only honoured for those. Uses the fal queue subscribe (submit
 * + poll) under the hood. Cost from the per-second pricing table.
 */
import { createFalClient, type FalClient } from '@fal-ai/client';

import type { VideoAdapter, VideoGenerateOptions } from '../../interfaces/video.js';
import type { GeneratedVideo } from '../../interfaces/types.js';
import { AdapterError } from '../../errors.js';
import { videoCostUsd } from '../pricing.js';

/** fal endpoint ids per requested backend. */
export const FAL_VIDEO_MODELS = {
  kling: 'fal-ai/kling-video/v2/master/text-to-video',
  klingImage: 'fal-ai/kling-video/v2/master/image-to-video',
  veo: 'fal-ai/veo3',
  runway: 'fal-ai/runway-gen4/turbo',
  hailuo: 'fal-ai/minimax/hailuo-02/standard/text-to-video',
} as const;

/** Backends that carry native audio (ADR-007). */
const AUDIO_CAPABLE = new Set<string>([
  FAL_VIDEO_MODELS.kling,
  FAL_VIDEO_MODELS.klingImage,
  FAL_VIDEO_MODELS.veo,
  FAL_VIDEO_MODELS.runway,
]);

/** Per-gen duration cap (seconds). */
const MAX_DURATION_S = 10;

type LooseFalClient = {
  subscribe: (
    endpointId: string,
    options: { input: Record<string, unknown>; logs?: boolean },
  ) => Promise<{ data: unknown; requestId?: string }>;
};

interface FalVideoOut {
  video?: { url?: string; duration?: number };
  duration?: number;
}

export interface FalVideoAdapterOptions {
  apiKey: string;
  client?: FalClient;
}

export class FalVideoAdapter implements VideoAdapter {
  readonly name = 'fal-video';
  private readonly client: LooseFalClient;

  constructor(opts: FalVideoAdapterOptions) {
    if (!opts.apiKey && !opts.client) throw new AdapterError('FAL_API_KEY missing', this.name);
    this.client = (opts.client ??
      createFalClient({ credentials: opts.apiKey })) as unknown as LooseFalClient;
  }

  /** Map a friendly modelHint ('kling'|'veo'|'runway'|'hailuo') → fal endpoint. */
  resolveModel(opts: VideoGenerateOptions): string {
    const hint = opts.modelHint?.toLowerCase();
    const hasRef = Boolean(opts.referenceImageKey);
    switch (hint) {
      case undefined:
      case 'kling':
        return hasRef ? FAL_VIDEO_MODELS.klingImage : FAL_VIDEO_MODELS.kling;
      case 'veo':
        return FAL_VIDEO_MODELS.veo;
      case 'runway':
        return FAL_VIDEO_MODELS.runway;
      case 'hailuo':
        return FAL_VIDEO_MODELS.hailuo;
      default:
        // Treat any other hint as a raw fal endpoint id (forward as-is).
        return opts.modelHint as string;
    }
  }

  async generateVideo(opts: VideoGenerateOptions): Promise<GeneratedVideo> {
    const model = this.resolveModel(opts);
    const requestedS = Math.max(1, Math.min(opts.durationS ?? 5, MAX_DURATION_S));
    const wantAudio = Boolean(opts.withAudio) && AUDIO_CAPABLE.has(model);

    const input: Record<string, unknown> = {
      prompt: opts.prompt,
      duration: requestedS,
    };
    if (wantAudio) input.enable_audio = true;
    if (opts.referenceImageKey) input.image_url = opts.referenceImageKey;

    let data: FalVideoOut;
    try {
      const res = await this.client.subscribe(model, { input, logs: false });
      data = res.data as FalVideoOut;
    } catch (err) {
      throw new AdapterError(`Fal video generation failed (${model})`, this.name, err);
    }

    const url = data.video?.url;
    if (!url) throw new AdapterError(`Fal returned no video url (${model})`, this.name);

    const actualS = data.video?.duration ?? data.duration ?? requestedS;
    return {
      url,
      durationMs: Math.round(actualS * 1000),
      hasAudio: wantAudio,
      usage: {
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: videoCostUsd(model, actualS),
        latency_ms: 0,
        model,
        provider: this.name,
      },
    };
  }
}
