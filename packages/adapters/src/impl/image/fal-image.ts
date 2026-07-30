/**
 * FalImageAdapter — text-to-image via fal.ai's queue API using @fal-ai/client.
 *
 * Model selection (ADR-007):
 *   - text-heavy prompts (posters, typography) → Ideogram v3 / Seedream 4.0
 *   - default / edit (with reference images) → FLUX (Kontext for edits)
 * `modelHint` forces an exact fal endpoint id. aspectRatio + count are mapped to
 * fal's input schema. Returns image URLs (caller stores them via StorageAdapter,
 * per the interface's "caller stores" contract). Cost from the pricing table.
 *
 * NOTE (nano-banana): there is no standalone production HTTP endpoint for
 * nano-banana usable from the Node app — it is reached via fal / gemini-image.
 * `NanoBananaImageAdapter` (see nano-banana.ts) documents this and delegates to
 * the fal FLUX/edit path.
 */
import { createFalClient, type FalClient } from '@fal-ai/client';

import type { ImageAdapter, ImageGenerateOptions } from '../../interfaces/image.js';
import type { GeneratedImage } from '../../interfaces/types.js';
import { AdapterError } from '../../errors.js';
import { imageCostUsd } from '../pricing.js';

/** fal endpoint ids per role. */
export const FAL_IMAGE_MODELS = {
  ideogram: 'fal-ai/ideogram/v3',
  seedream: 'fal-ai/bytedance/seedream/v4/text-to-image',
  flux: 'fal-ai/flux/dev',
  fluxEdit: 'fal-ai/flux-pro/kontext',
  fluxFast: 'fal-ai/flux/schnell',
} as const;

/** Keywords that hint text-heavy generation → Ideogram (best glyph fidelity). */
const TEXT_HEAVY_RE = /\b(poster|typograph|headline|caption|logo|billboard|meme|quote|text\b)/i;

/** Rough w/h for common aspect ratios (fal accepts image_size enum or w/h). */
const ASPECT_TO_SIZE: Record<string, string> = {
  '1:1': 'square_hd',
  '16:9': 'landscape_16_9',
  '9:16': 'portrait_16_9',
  '4:3': 'landscape_4_3',
  '3:4': 'portrait_4_3',
};

/** Loose view of the fal client so we can call arbitrary endpoint ids. */
type LooseFalClient = {
  subscribe: (
    endpointId: string,
    options: { input: Record<string, unknown>; logs?: boolean },
  ) => Promise<{ data: unknown; requestId?: string }>;
};

interface FalImageOut {
  images?: Array<{ url?: string; width?: number; height?: number; content_type?: string }>;
}

export interface FalImageAdapterOptions {
  apiKey: string;
  /** Override the client (tests). */
  client?: FalClient;
}

export class FalImageAdapter implements ImageAdapter {
  readonly name = 'fal-image';
  private readonly client: LooseFalClient;

  constructor(opts: FalImageAdapterOptions) {
    if (!opts.apiKey && !opts.client) {
      throw new AdapterError('FAL_API_KEY missing', this.name);
    }
    this.client = (opts.client ??
      createFalClient({ credentials: opts.apiKey })) as unknown as LooseFalClient;
  }

  /** Choose a fal endpoint from hint / reference / prompt content. */
  resolveModel(opts: ImageGenerateOptions): string {
    if (opts.modelHint) return opts.modelHint;
    if (opts.referenceImageKeys?.length) return FAL_IMAGE_MODELS.fluxEdit;
    if (TEXT_HEAVY_RE.test(opts.prompt)) return FAL_IMAGE_MODELS.ideogram;
    return FAL_IMAGE_MODELS.flux;
  }

  async generateImage(opts: ImageGenerateOptions): Promise<GeneratedImage[]> {
    const model = this.resolveModel(opts);
    const count = Math.max(1, Math.min(opts.count ?? 1, 4));
    const started = Date.now();

    const input: Record<string, unknown> = {
      prompt: opts.prompt,
      num_images: count,
    };
    if (opts.negativePrompt) input.negative_prompt = opts.negativePrompt;
    if (opts.aspectRatio) {
      // Some fal models take image_size enum, others aspect_ratio — send both.
      const size = ASPECT_TO_SIZE[opts.aspectRatio];
      if (size) input.image_size = size;
      input.aspect_ratio = opts.aspectRatio;
    }
    if (opts.referenceImageKeys?.length) {
      input.image_url = opts.referenceImageKeys[0];
      input.image_urls = opts.referenceImageKeys;
    }

    let data: FalImageOut;
    try {
      const res = await this.client.subscribe(model, { input, logs: false });
      data = res.data as FalImageOut;
    } catch (err) {
      throw new AdapterError(`Fal image generation failed (${model})`, this.name, err);
    }

    const images = data.images ?? [];
    if (images.length === 0) {
      throw new AdapterError(`Fal returned no images (${model})`, this.name);
    }

    const latency = Date.now() - started;
    const perImageCost = imageCostUsd(model, images.length) / images.length;

    return images.map((img) => {
      const out: GeneratedImage = {
        usage: {
          tokens_in: 0,
          tokens_out: 0,
          cost_usd: Math.round(perImageCost * 1e6) / 1e6,
          latency_ms: latency,
          model,
          provider: this.name,
        },
      };
      if (img.url) out.url = img.url;
      if (typeof img.width === 'number') out.width = img.width;
      if (typeof img.height === 'number') out.height = img.height;
      return out;
    });
  }
}
