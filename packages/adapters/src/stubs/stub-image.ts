// STUB — replace with real impl in src/impl/<name>.ts (owned by another agent).
//
// Real backend: nano-banana-2 (primary) + fal.ai (ADR-007). MCP servers:
// `nano-banana-2` (generate_image/edit_image) and `fal` (generate/queue).
//
// This stub returns clearly-marked placeholder images (stub:// url) with a
// zero-cost Usage instead of throwing, so a downstream dev run does not crash.

import type { Usage } from '@marketforge/contracts';
import type { ImageAdapter, ImageGenerateOptions } from '../interfaces/image.js';
import type { GeneratedImage } from '../interfaces/types.js';

function zeroUsage(model: string): Usage {
  return { tokens_in: 0, tokens_out: 0, cost_usd: 0, latency_ms: 0, model, provider: 'stub' };
}

export class StubImageAdapter implements ImageAdapter {
  readonly name = 'stub-image';

  async generateImage(opts: ImageGenerateOptions): Promise<GeneratedImage[]> {
    // TODO(impl): call nano-banana-2 / fal; upload result to storage, set storageKey.
    const model = opts.modelHint ?? 'stub-nano-banana-2';
    const count = Math.max(1, opts.count ?? 1);
    const slug = encodeURIComponent(opts.prompt.slice(0, 40));
    return Array.from({ length: count }, (_v, i) => ({
      url: `stub://image/${slug}/${i}`,
      width: 1024,
      height: 1024,
      usage: zeroUsage(model),
    }));
  }
}
