/**
 * generate-video processor — MEDIA-SCOPE policy.
 *
 * Video is scoped to **Kling short-form (via fal) + GIF loops + poster images**;
 * big/long-form video is PAUSED. The pure {@link resolveMediaPlan} decides the
 * action from the payload + env config; this processor performs the side effects:
 *
 *   - 'paused' → set the content item to a terminal-but-OK `needs_media` state
 *     (NOT failed), enqueue a `notify` warning ("Long-form video paused"), write
 *     an audit row, and return successfully. The video adapter is NEVER called,
 *     so paused jobs incur zero spend.
 *   - 'short'  → generate a Kling short via fal, store the mp4, write a
 *     kind=video asset (ready). Logged via logAiRun.
 *   - 'gif'    → generate a short SILENT clip, export it to .gif with ffmpeg
 *     (ffmpeg-static), store BOTH the mp4 (kind=video) and the gif (kind=gif).
 *     If ffmpeg is unavailable, degrade: store the silent mp4 tagged as gif-style
 *     and notify (no crash).
 *
 * The video adapter routes Kling via fal.ai's queue API (ADR-007).
 */
import { adapters } from '@marketforge/adapters';
import { env } from '@marketforge/config';
import { enqueueNotify } from '@marketforge/queue';
import { db, withTenant, assets } from '@marketforge/db';
import { logAiRun } from '@marketforge/logger';
import type { GeneratedVideo } from '@marketforge/adapters';
import type { PayloadFor } from '@marketforge/contracts';
import type { Logger } from '@marketforge/logger';
import { defineProcessor } from './base.js';
import { TerminalError, toError } from '../lib/errors.js';
import { getBrand } from '../lib/brand.js';
import { setContentStatus } from '../lib/content.js';
import { writeAudit } from '../lib/audit.js';
import { resolveMediaPlan, type MediaPlan } from '../lib/media-policy.js';
import { downloadToBuffer, exportGif, GifExportUnavailableError } from '../lib/gif.js';

/** Media policy config drawn from the validated env (single source of truth). */
function mediaConfig() {
  return {
    enabled: env.VIDEO_ENABLED,
    allowLongform: env.VIDEO_ALLOW_LONGFORM,
    shortMaxS: env.VIDEO_SHORT_MAX_S,
    gifMaxS: env.GIF_MAX_S,
    defaultModel: env.VIDEO_DEFAULT_MODEL,
  };
}

/** Deterministic storage key for a generated video/gif asset. */
function mediaKey(
  orgId: string,
  brandId: string,
  contentItemId: string | undefined,
  ext: 'mp4' | 'gif',
): string {
  const base = contentItemId ?? 'adhoc';
  return `org/${orgId}/brand/${brandId}/content/${base}/video-${Date.now()}.${ext}`;
}

/** Resolve mp4 bytes from an adapter result (b64/url), or undefined if none. */
async function resolveMp4Buffer(video: GeneratedVideo): Promise<Buffer | undefined> {
  if (video.url) return downloadToBuffer(video.url);
  return undefined;
}

export const generateVideoProcessor = defineProcessor('generate-video', async ({ payload, log }) => {
  const { org_id, brand_id, campaign_id } = payload;
  if (!brand_id) throw new TerminalError('generate-video job requires brand_id');

  const plan = resolveMediaPlan(
    {
      durationS: payload.duration_s,
      outputFormat: payload.output_format,
      longform: payload.longform,
      withAudio: payload.with_audio,
      modelHint: payload.model_hint,
    },
    mediaConfig(),
  );

  log.info(
    { action: plan.action, model: plan.model, durationS: plan.durationS, reason: plan.reason },
    'media plan resolved',
  );

  // --- PAUSED: skip + notify (no spend, no adapter call) -------------------
  if (plan.action === 'paused') {
    await handlePaused(payload, plan, log);
    return { action: 'paused', reason: plan.reason };
  }

  // --- Generate the clip (short or gif source) — silent for gif ------------
  // ADR-007: default to Kling via fal; plan.model already resolved to the default
  // (kling) when no explicit hint was given.
  const startedAt = Date.now();
  const video = await adapters.video.generateVideo({
    prompt: payload.prompt,
    durationS: plan.durationS,
    withAudio: plan.withAudio,
    modelHint: plan.model,
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

  if (plan.action === 'gif') {
    return await handleGif(payload, plan, video, log);
  }
  return await handleShort(payload, video, log);
});

// --- handlers ---------------------------------------------------------------

type VideoPayload = PayloadFor<'generate-video'>;

/** Set content item to `needs_media`, enqueue a warning notify, audit. */
async function handlePaused(
  payload: VideoPayload,
  plan: MediaPlan,
  log: Logger,
): Promise<void> {
  const { org_id, brand_id, campaign_id } = payload;

  // Resolve a notification channel from the brand default (fallback: dashboard).
  const channel = await withTenant(db, org_id, async (tx) => {
    const brand = brand_id ? await getBrand(tx, brand_id) : undefined;
    const notifyChannel =
      (brand as { notifyChannel?: string } | undefined)?.notifyChannel ?? 'dashboard';
    if (payload.content_item_id) {
      // Terminal-but-OK: do NOT mark failed. `needs_media` signals a human that
      // media is intentionally pending (long-form paused).
      await setContentStatus(tx, payload.content_item_id, 'needs_media');
    }
    await writeAudit(tx, org_id, {
      action: 'video.paused',
      entityType: 'content_item',
      entityId: payload.content_item_id,
      after: { reason: plan.reason, requested_duration_s: payload.duration_s, longform: payload.longform },
    });
    return notifyChannel;
  }).catch((err) => {
    throw new TerminalError(`failed to record paused video: ${toError(err).message}`, err);
  });

  await enqueueNotify({
    org_id,
    brand_id,
    campaign_id,
    channel: (['email', 'slack', 'discord', 'telegram', 'dashboard'] as const).includes(
      channel as never,
    )
      ? (channel as 'email' | 'slack' | 'discord' | 'telegram' | 'dashboard')
      : 'dashboard',
    type: 'warning',
    title: 'Long-form video paused',
    body: plan.reason,
    payload: { content_item_id: payload.content_item_id ?? null, reason: plan.reason },
    attempt_reason: 'initial',
  }).catch((err) => log.info({ err: toError(err).message }, 'failed to enqueue paused-video notify'));

  log.info(
    { content_item_id: payload.content_item_id, reason: plan.reason },
    'generate-video paused (skip + notify, no spend)',
  );
}

/** Store the mp4 and write a kind=video asset (ready). */
async function handleShort(
  payload: VideoPayload,
  video: GeneratedVideo,
  log: Logger,
): Promise<{ action: 'short'; asset_id: string }> {
  const { org_id, brand_id } = payload;
  const assetId = await withTenant(db, org_id, async (tx) => {
    let storageKey = video.storageKey;
    let bytes: number | undefined;
    if (!storageKey) {
      const buf = await resolveMp4Buffer(video);
      if (buf) {
        const key = mediaKey(org_id, brand_id!, payload.content_item_id, 'mp4');
        const stored = await adapters.storage.put(key, buf, 'video/mp4');
        storageKey = stored.key;
        bytes = stored.bytes;
      } else if (video.url) {
        storageKey = video.url; // last-resort reference
      }
    }
    if (!storageKey) throw new TerminalError('video adapter returned no storageKey/url');

    const inserted = await tx
      .insert(assets)
      .values({
        orgId: org_id,
        brandId: brand_id!,
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

  log.info({ content_item_id: payload.content_item_id, asset_id: assetId }, 'generate-video (short) complete');
  return { action: 'short', asset_id: assetId };
}

/**
 * Store the source mp4 (kind=video) + export to .gif (kind=gif). If ffmpeg is
 * unavailable, degrade to storing the silent mp4 tagged as gif-style and notify.
 */
async function handleGif(
  payload: VideoPayload,
  plan: MediaPlan,
  video: GeneratedVideo,
  log: Logger,
): Promise<{ action: 'gif'; asset_ids: string[]; degraded: boolean }> {
  const { org_id, brand_id, campaign_id } = payload;

  const mp4 = await resolveMp4Buffer(video);
  if (!mp4 && !video.storageKey) {
    throw new TerminalError('gif source: video adapter returned no bytes/url/storageKey');
  }

  // Attempt the gif export up-front (outside the tx) so we know the plan.
  let gifBuf: Buffer | undefined;
  let degraded = false;
  if (mp4) {
    try {
      gifBuf = await exportGif(mp4, { fps: 12, width: 480 });
    } catch (err) {
      if (err instanceof GifExportUnavailableError) {
        degraded = true;
        log.warn({ err: err.message }, 'ffmpeg unavailable; degrading gif → silent mp4 tagged gif-style');
      } else {
        throw new TerminalError(`gif export failed: ${toError(err).message}`, err);
      }
    }
  } else {
    // No local bytes to convert — degrade to referencing the mp4.
    degraded = true;
  }

  const assetIds: string[] = [];
  await withTenant(db, org_id, async (tx) => {
    // 1) Store the source mp4 (kind=video) — keep it alongside the gif.
    let mp4Key = video.storageKey;
    let mp4Bytes: number | undefined;
    if (!mp4Key && mp4) {
      const key = mediaKey(org_id, brand_id!, payload.content_item_id, 'mp4');
      const stored = await adapters.storage.put(key, mp4, 'video/mp4');
      mp4Key = stored.key;
      mp4Bytes = stored.bytes;
    } else if (!mp4Key && video.url) {
      mp4Key = video.url;
    }
    if (mp4Key) {
      const v = await tx
        .insert(assets)
        .values({
          orgId: org_id,
          brandId: brand_id!,
          contentItemId: payload.content_item_id ?? null,
          kind: 'video',
          storageKey: mp4Key,
          mimeType: 'video/mp4',
          bytes: mp4Bytes ?? null,
          durationMs: video.durationMs,
          model: video.usage.model,
          status: 'ready',
        })
        .returning({ id: assets.id });
      assetIds.push(v[0]?.id as string);
    }

    // 2) Store the gif (kind=gif). On degrade, tag the mp4 as gif-style instead.
    if (gifBuf) {
      const gifKey = mediaKey(org_id, brand_id!, payload.content_item_id, 'gif');
      const stored = await adapters.storage.put(gifKey, gifBuf, 'image/gif');
      const g = await tx
        .insert(assets)
        .values({
          orgId: org_id,
          brandId: brand_id!,
          contentItemId: payload.content_item_id ?? null,
          kind: 'gif',
          storageKey: stored.key,
          mimeType: 'image/gif',
          bytes: stored.bytes ?? null,
          durationMs: video.durationMs,
          model: video.usage.model,
          status: 'ready',
        })
        .returning({ id: assets.id });
      assetIds.push(g[0]?.id as string);
    } else if (mp4Key) {
      // Degraded: record a gif-kind row pointing at the silent mp4 so downstream
      // still sees a "gif-style" asset; the real container is mp4.
      const g = await tx
        .insert(assets)
        .values({
          orgId: org_id,
          brandId: brand_id!,
          contentItemId: payload.content_item_id ?? null,
          kind: 'gif',
          storageKey: mp4Key,
          mimeType: 'video/mp4',
          bytes: mp4Bytes ?? null,
          durationMs: video.durationMs,
          model: video.usage.model,
          status: 'ready',
        })
        .returning({ id: assets.id });
      assetIds.push(g[0]?.id as string);
    }

    await writeAudit(tx, org_id, {
      action: degraded ? 'video.gif.degraded' : 'video.gif',
      entityType: 'content_item',
      entityId: payload.content_item_id,
      after: { reason: plan.reason, degraded, asset_count: assetIds.length },
    });
  }).catch((err) => {
    throw new TerminalError(`failed to persist gif assets: ${toError(err).message}`, err);
  });

  if (degraded) {
    await enqueueNotify({
      org_id,
      brand_id,
      campaign_id,
      channel: 'dashboard',
      type: 'warning',
      title: 'GIF export degraded',
      body: 'ffmpeg was unavailable; stored a silent mp4 tagged as gif-style instead of an animated .gif.',
      payload: { content_item_id: payload.content_item_id ?? null },
      attempt_reason: 'initial',
    }).catch(() => undefined);
  }

  log.info(
    { content_item_id: payload.content_item_id, assets: assetIds.length, degraded },
    'generate-video (gif) complete',
  );
  return { action: 'gif', asset_ids: assetIds, degraded };
}
