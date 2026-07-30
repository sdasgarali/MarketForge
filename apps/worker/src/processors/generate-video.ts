/**
 * generate-video processor — Phase 3 (metered, gated). Video generation is a
 * hard cost risk (2026 APIs run $0.05–$0.75/sec, CLAUDE.md), so it is GATED off
 * by default and only runs when explicitly enabled via env
 * `WORKER_ENABLE_VIDEO=true`. When enabled it calls the video adapter, stores
 * bytes, and writes a video `assets` row — a working, minimal skeleton.
 *
 * The video adapter routes Kling via fal.ai's queue API (ADR-007).
 */
import { adapters } from '@marketforge/adapters';
import { db, withTenant, assets } from '@marketforge/db';
import { logAiRun } from '@marketforge/logger';
import { defineProcessor } from './base.js';
import { TerminalError, toError } from '../lib/errors.js';

/** Video is opt-in; the gate keeps uncontrolled spend impossible in MVP. */
function videoEnabled(): boolean {
  return process.env.WORKER_ENABLE_VIDEO === 'true';
}

export const generateVideoProcessor = defineProcessor('generate-video', async ({ payload, log }) => {
  const { org_id, brand_id, campaign_id } = payload;
  if (!brand_id) throw new TerminalError('generate-video job requires brand_id');
  if (!videoEnabled()) {
    // Terminal (not retryable) — the feature is intentionally disabled.
    throw new TerminalError('video generation is disabled (set WORKER_ENABLE_VIDEO=true to enable; Phase 3)');
  }

  const startedAt = Date.now();
  const video = await adapters.video.generateVideo({
    prompt: payload.prompt,
    durationS: payload.duration_s,
    withAudio: payload.with_audio,
    modelHint: payload.model_hint,
  });

  logAiRun(log, {
    workflow: 'generate-video',
    agent: 'video_prompt_engineer',
    model: video.usage.model,
    provider: video.usage.provider,
    tokens_in: video.usage.tokens_in ?? 0,
    tokens_out: video.usage.tokens_out ?? 0,
    cost_usd: video.usage.cost_usd ?? 0,
    latency_ms: video.usage.latency_ms || Date.now() - startedAt,
    retries: 0,
    org_id,
    brand_id,
    campaign_id,
    content_item_id: payload.content_item_id,
    status: 'ok',
  });

  const assetId = await withTenant(db, org_id, async (tx) => {
    let storageKey = video.storageKey;
    let bytes: number | undefined;
    if (!storageKey && video.url) {
      // Adapter returned a URL only — record it as the key reference. A real
      // impl may download + re-store; for the skeleton we store the reference.
      storageKey = video.url;
    }
    if (!storageKey) throw new TerminalError('video adapter returned no storageKey/url', undefined);

    const inserted = await tx
      .insert(assets)
      .values({
        orgId: org_id,
        brandId: brand_id,
        contentItemId: payload.content_item_id ?? null,
        kind: 'video',
        storageKey,
        mimeType: 'video/mp4',
        bytes: bytes ?? null,
        durationMs: video.durationMs,
        model: video.usage.model,
        status: 'ready',
      })
      .returning({ id: assets.id });
    return inserted[0]?.id as string;
  }).catch((err) => {
    throw new TerminalError(`failed to persist video asset: ${toError(err).message}`, err);
  });

  log.info({ content_item_id: payload.content_item_id, asset_id: assetId }, 'generate-video complete');
  return { asset_id: assetId };
});
