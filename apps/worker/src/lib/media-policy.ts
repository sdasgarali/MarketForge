/**
 * media-policy — PURE decision function for the MEDIA-SCOPE policy.
 *
 * MarketForge scopes video to **Kling short-form (via fal) + GIF loops + poster
 * images**; big/long-form video is PAUSED (skip + notify, no spend) until it is
 * explicitly re-enabled with `VIDEO_ALLOW_LONGFORM`.
 *
 * This function contains NO I/O — it only maps an input + config to a plan, so
 * it is trivially unit-testable. The processor performs the side effects.
 *
 * Rules (in order):
 *   1. Video disabled OR (longform || duration > shortMaxS) while long-form is
 *      NOT allowed  → action 'paused'.
 *   2. output_format 'gif'  → action 'gif': short SILENT clip, duration clamped
 *      to <= gifMaxS, exported to .gif downstream.
 *   3. otherwise            → action 'short': duration clamped to <= shortMaxS,
 *      model defaults to `defaultModel` (kling), mp4, audio as requested.
 */

export type MediaAction = 'short' | 'gif' | 'paused' | 'longform';
export type OutputFormat = 'mp4' | 'gif';

export interface MediaPolicyConfig {
  /** Master video switch (VIDEO_ENABLED). */
  enabled: boolean;
  /** The single re-enable switch for big/long-form video (VIDEO_ALLOW_LONGFORM). */
  allowLongform: boolean;
  /** Short-form duration cap in seconds (VIDEO_SHORT_MAX_S). */
  shortMaxS: number;
  /** GIF duration cap in seconds (GIF_MAX_S). */
  gifMaxS: number;
  /** Default video model when no hint is supplied (VIDEO_DEFAULT_MODEL). */
  defaultModel: string;
  /** Per-clip length for long-form chunking (VIDEO_CLIP_MAX_S). Default 10. */
  clipMaxS?: number;
  /** Hard cap on a single long-form video's total length (VIDEO_LONGFORM_MAX_S). */
  longformMaxS?: number;
}

export interface MediaPolicyInput {
  /** Requested duration (seconds). Defaults handled by the caller/contract. */
  durationS?: number;
  /** Requested output container. 'gif' routes to the GIF path. */
  outputFormat?: OutputFormat;
  /** Explicit "big video" / long-form request. */
  longform?: boolean;
  /** Whether the caller asked for audio (ignored for GIF — always silent). */
  withAudio?: boolean;
  /** Friendly model hint ('kling'|'veo'|...). Falls back to config.defaultModel. */
  modelHint?: string;
}

export interface MediaPlan {
  action: MediaAction;
  /** Resolved model hint (only meaningful for 'short'/'gif'). */
  model: string;
  /** Clamped duration in seconds the adapter should generate. */
  durationS: number;
  /** Whether the generated clip carries audio (GIF is always false). */
  withAudio: boolean;
  /** Final output container the processor should persist. */
  outputFormat: OutputFormat;
  /** For 'longform': number of clip rounds to generate then concatenate. */
  rounds?: number;
  /** For 'longform': length of each clip round (seconds). */
  clipS?: number;
  /** Human-readable explanation (audit log + notification body). */
  reason: string;
}

function clamp(value: number, min: number, max: number): number {
  if (Number.isNaN(value)) return min;
  return Math.max(min, Math.min(value, max));
}

/**
 * Resolve the media plan for a generate-video job. Pure: same input + config
 * always yields the same plan.
 */
export function resolveMediaPlan(
  input: MediaPolicyInput,
  config: MediaPolicyConfig,
): MediaPlan {
  const requested = input.durationS ?? 0;
  const wantsGif = input.outputFormat === 'gif';

  // 1) Paused: video disabled, or a long-form/oversized request without the
  //    long-form allowance. GIF requests are never "big" (they're capped low),
  //    so an over-cap duration only triggers pause for non-gif requests.
  if (!config.enabled) {
    return {
      action: 'paused',
      model: config.defaultModel,
      durationS: 0,
      withAudio: false,
      outputFormat: input.outputFormat ?? 'mp4',
      reason: 'video generation is disabled (VIDEO_ENABLED=false)',
    };
  }

  const isBig =
    Boolean(input.longform) || (!wantsGif && requested > config.shortMaxS);
  if (isBig && !config.allowLongform) {
    const why = input.longform
      ? 'explicit long-form request'
      : `duration ${requested}s exceeds short cap ${config.shortMaxS}s`;
    return {
      action: 'paused',
      model: config.defaultModel,
      durationS: 0,
      withAudio: false,
      outputFormat: input.outputFormat ?? 'mp4',
      reason: `long-form video paused (${why}); set VIDEO_ALLOW_LONGFORM=true to enable`,
    };
  }

  // 1b) Long-form ALLOWED: chunk the total into N clip-rounds to concatenate.
  //     Total length is capped by longformMaxS (runaway guard); each round is
  //     clipMaxS (<= shortMaxS). rounds = ceil(total / clipS).
  if (isBig && config.allowLongform) {
    const clipS = clamp(config.clipMaxS ?? 10, 1, config.shortMaxS);
    const longformMaxS = config.longformMaxS ?? 300;
    const total = clamp(requested || longformMaxS, clipS, longformMaxS);
    const rounds = Math.max(1, Math.ceil(total / clipS));
    return {
      action: 'longform',
      model: input.modelHint ?? config.defaultModel,
      durationS: total,
      withAudio: Boolean(input.withAudio),
      outputFormat: 'mp4',
      rounds,
      clipS,
      reason: `long-form video (${total}s = ${rounds} × ${clipS}s clips, model=${input.modelHint ?? config.defaultModel})`,
    };
  }

  // 2) GIF: short SILENT clip, clamped to the GIF cap, exported to .gif.
  if (wantsGif) {
    const durationS = clamp(requested || config.gifMaxS, 1, config.gifMaxS);
    return {
      action: 'gif',
      model: input.modelHint ?? config.defaultModel,
      durationS,
      withAudio: false,
      outputFormat: 'gif',
      reason: `gif loop (${durationS}s silent, clamped to <= ${config.gifMaxS}s)`,
    };
  }

  // 3) Short: clamp to the short cap; default model is kling; audio as asked.
  //    (Long-form was already handled above, so `requested` is within the cap.)
  const durationS = clamp(requested || config.shortMaxS, 1, config.shortMaxS);
  return {
    action: 'short',
    model: input.modelHint ?? config.defaultModel,
    durationS,
    withAudio: Boolean(input.withAudio),
    outputFormat: 'mp4',
    reason: `short-form video (${durationS}s, model=${input.modelHint ?? config.defaultModel})`,
  };
}
