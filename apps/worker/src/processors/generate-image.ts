/**
 * generate-image processor — Stage 3 (parallel branch). Crafts a refined image
 * prompt (image-prompt agent), generates images (image adapter), persists bytes
 * to storage (S3 system-of-record via adapter), and writes an `assets` row
 * (kind=image, status=ready) linked to the content_item.
 *
 * Then fan-in: if the content_item now has both copy + a ready image, enqueue
 * `review`. Also enqueues `drive-mirror` (low-priority Drive mirror, ADR-006).
 *
 * NEXT STAGES: review (fan-in), drive-mirror.
 */
import { adapters } from '@marketforge/adapters';
import { enqueueReview, enqueueDriveMirror } from '@marketforge/queue';
import { db, withTenant, assets } from '@marketforge/db';
import { defineProcessor } from './base.js';
import { TerminalError, toError } from '../lib/errors.js';
import { getBrand, brandContextLine, brandPrefix } from '../lib/brand.js';
import { getContentItem, isReadyForReview } from '../lib/content.js';
import { runImagePromptAgent } from '../agents/image-prompt.agent.js';

/** Build a deterministic storage key for a generated image. */
function imageKey(orgId: string, brandId: string, contentItemId: string | undefined, idx: number): string {
  const base = contentItemId ?? 'adhoc';
  return `org/${orgId}/brand/${brandId}/content/${base}/image-${Date.now()}-${idx}.png`;
}

export const generateImageProcessor = defineProcessor('generate-image', async ({ payload, log }) => {
  const { org_id, brand_id, campaign_id } = payload;
  if (!brand_id) throw new TerminalError('generate-image job requires brand_id');

  // 1) Craft a refined prompt using brand style (LLM call, logged).
  const refinedPrompt = await withTenant(db, org_id, async (tx) => {
    const brand = await getBrand(tx, brand_id);
    if (!brand) throw new TerminalError(`brand not found: ${brand_id}`);
    const item = payload.content_item_id ? await getContentItem(tx, payload.content_item_id) : undefined;
    return runImagePromptAgent(
      log,
      {
        workflow: 'generate-image',
        agent: 'image_prompt_engineer',
        org_id,
        brand_id,
        campaign_id,
        content_item_id: payload.content_item_id,
      },
      {
        caption: item?.caption ?? payload.prompt,
        brandContext: brandContextLine(brand),
        imageStyle: brand.imageStyle ?? undefined,
        platform: item?.platform ?? 'x',
        brandPrefix: brandPrefix(brand, org_id),
      },
    );
  });

  // 2) Generate the image(s). The image adapter emits GeneratedImage[].
  const images = await adapters.image.generateImage({
    prompt: refinedPrompt || payload.prompt,
    negativePrompt: payload.negative_prompt,
    aspectRatio: payload.aspect_ratio,
    count: payload.count,
    modelHint: payload.model_hint,
  });
  if (images.length === 0) throw new TerminalError('image adapter returned no images');

  // 3) Persist bytes + write asset rows within the tenant transaction.
  const assetIds: string[] = [];
  const assetKeys = new Map<string, string>();
  const result = await withTenant(db, org_id, async (tx) => {
    let idx = 0;
    for (const img of images) {
      let storageKey = img.storageKey;
      let bytes: number | undefined;
      // If the adapter returned raw bytes (b64), put them into storage. If it
      // already stored the object (storageKey), reuse that key.
      if (!storageKey && img.b64) {
        const buf = Buffer.from(img.b64, 'base64');
        const key = imageKey(org_id, brand_id, payload.content_item_id, idx);
        try {
          const stored = await adapters.storage.put(key, buf, 'image/png');
          storageKey = stored.key;
          bytes = stored.bytes;
        } catch (err) {
          throw new TerminalError(`storage.put failed for generated image: ${toError(err).message}`, err);
        }
      }
      if (!storageKey) {
        // No key and no bytes — nothing we can persist; skip this image.
        log.warn({ idx }, 'generated image had neither storageKey nor b64; skipping');
        idx++;
        continue;
      }

      const inserted = await tx
        .insert(assets)
        .values({
          orgId: org_id,
          brandId: brand_id,
          contentItemId: payload.content_item_id ?? null,
          kind: 'image',
          storageKey,
          mimeType: 'image/png',
          bytes: bytes ?? null,
          width: img.width ?? null,
          height: img.height ?? null,
          model: img.usage.model,
          status: 'ready',
        })
        .returning({ id: assets.id, storageKey: assets.storageKey });
      const id = inserted[0]?.id as string;
      assetIds.push(id);
      assetKeys.set(id, storageKey);
      idx++;
    }

    // Fan-in readiness check.
    let readyForReview = false;
    if (payload.content_item_id) {
      const item = await getContentItem(tx, payload.content_item_id);
      readyForReview = item ? await isReadyForReview(tx, item) : false;
    }
    return { readyForReview, firstAssetId: assetIds[0] };
  });

  // 4) Low-priority Drive mirror for each stored asset (ADR-006).
  for (const assetId of assetIds) {
    await enqueueDriveMirror({
      org_id,
      brand_id,
      asset_id: assetId,
      storage_key: assetKeys.get(assetId) ?? '',
      attempt_reason: 'initial',
    }).catch((err) => log.warn({ err: toError(err).message, assetId }, 'failed to enqueue drive-mirror'));
  }

  // 5) Fan-in: advance to review when text + image are both ready.
  if (payload.content_item_id && result.readyForReview) {
    await enqueueReview({
      org_id,
      brand_id,
      campaign_id,
      content_item_id: payload.content_item_id,
      threshold: 90,
      attempt_reason: payload.attempt_reason,
    });
  }

  log.info(
    { content_item_id: payload.content_item_id, assets: assetIds.length, readyForReview: result.readyForReview },
    'generate-image complete',
  );
  return { asset_ids: assetIds };
});
