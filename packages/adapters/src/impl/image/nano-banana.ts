/**
 * NanoBananaImageAdapter — documentation + delegation shim.
 *
 * ADR-007 names `nano-banana-2` as the image workhorse, but that capability is
 * exposed to THIS session as an MCP server only. The running Node app cannot
 * call MCP. There is no standalone, production HTTP endpoint for nano-banana we
 * can hit from the app; in production it is reached via fal (FLUX/edit) or the
 * Gemini image path. This adapter therefore delegates to `FalImageAdapter`'s
 * FLUX/edit path so callers wanting "nano-banana style" edits get a real result
 * without importing MCP. If/when a direct HTTP endpoint exists, swap the
 * delegate body for that REST call — the interface stays identical.
 */
import type { FalClient } from '@fal-ai/client';

import type { ImageAdapter, ImageGenerateOptions } from '../../interfaces/image.js';
import type { GeneratedImage } from '../../interfaces/types.js';
import { FalImageAdapter, FAL_IMAGE_MODELS } from './fal-image.js';

export interface NanoBananaImageAdapterOptions {
  apiKey: string;
  client?: FalClient;
}

export class NanoBananaImageAdapter implements ImageAdapter {
  readonly name = 'nano-banana-image';
  private readonly delegate: FalImageAdapter;

  constructor(opts: NanoBananaImageAdapterOptions) {
    this.delegate = new FalImageAdapter(opts);
  }

  async generateImage(opts: ImageGenerateOptions): Promise<GeneratedImage[]> {
    // Default nano-banana behaviour is edit/compose-heavy → route to FLUX edit
    // unless the caller forced a model.
    const routed: ImageGenerateOptions = opts.modelHint
      ? opts
      : { ...opts, modelHint: FAL_IMAGE_MODELS.fluxEdit };
    return this.delegate.generateImage(routed);
  }
}
