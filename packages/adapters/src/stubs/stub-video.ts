// STUB — replace with real impl in src/impl/<name>.ts (owned by another agent).
//
// Real backend (Phase 3): Google Veo / Runway / Kling-via-fal (ADR-007). MCP
// servers: `google-veo-3-1`, `fal` (Kling + others via queue API), `higgsfield`.
// Kling is NOT native — it goes through fal.ai's queue API.
//
// This stub returns a clearly-marked placeholder video (stub:// url) with a
// zero-cost Usage instead of throwing, so a downstream dev run does not crash.

import type { Usage } from '@marketforge/contracts';
import type { VideoAdapter, VideoGenerateOptions } from '../interfaces/video.js';
import type { GeneratedVideo } from '../interfaces/types.js';

function zeroUsage(model: string): Usage {
  return { tokens_in: 0, tokens_out: 0, cost_usd: 0, latency_ms: 0, model, provider: 'stub' };
}

export class StubVideoAdapter implements VideoAdapter {
  readonly name = 'stub-video';

  async generateVideo(opts: VideoGenerateOptions): Promise<GeneratedVideo> {
    // TODO(impl): route by opts.modelHint to Veo/Runway/Kling(via fal); poll queue.
    const model = opts.modelHint ?? 'stub-veo';
    const slug = encodeURIComponent(opts.prompt.slice(0, 40));
    return {
      url: `stub://video/${slug}`,
      durationMs: (opts.durationS ?? 5) * 1000,
      hasAudio: opts.withAudio ?? false,
      usage: zeroUsage(model),
    };
  }
}
