/**
 * generate-text processor — Stage 2. Copywriter agent produces platform copy +
 * caption + hashtags. Creates or updates the content_item (status → generating),
 * then:
 *   - enqueues `generate-image` for an accompanying image (parallel branch);
 *   - checks review readiness (fan-in) and enqueues `review` if the image is
 *     already ready (e.g. on a regeneration where the asset already exists).
 *
 * Supports the regeneration loop: attempt_reason='regeneration' updates the
 * existing content_item in place and bumps its version.
 *
 * NEXT STAGES: generate-image (always), review (when both text+image ready).
 */
import { eq } from 'drizzle-orm';
import { enqueueGenerateImage, enqueueReview } from '@marketforge/queue';
import { db, withTenant, contentItems, researchReports } from '@marketforge/db';
import type { ContentType, Platform } from '@marketforge/contracts';
import { defineProcessor } from './base.js';
import { TerminalError } from '../lib/errors.js';
import { getBrand, brandContextLine, brandPrefix, getPromptTemplateBody } from '../lib/brand.js';
import { getContentItem, isReadyForReview, setContentStatus } from '../lib/content.js';
import { runCopywriterAgent } from '../agents/copywriter.agent.js';

export const generateTextProcessor = defineProcessor('generate-text', async ({ payload, log }) => {
  const { org_id, brand_id, campaign_id } = payload;
  if (!brand_id) throw new TerminalError('generate-text job requires brand_id');

  const result = await withTenant(db, org_id, async (tx) => {
    const brand = await getBrand(tx, brand_id);
    if (!brand) throw new TerminalError(`brand not found: ${brand_id}`);

    // Pull research summary if referenced.
    let researchSummary: string | undefined;
    let keywords: string[] | undefined;
    if (payload.research_report_id) {
      const rows = await tx
        .select({ summary: researchReports.summary, keywords: researchReports.keywords })
        .from(researchReports)
        .where(eq(researchReports.id, payload.research_report_id))
        .limit(1);
      researchSummary = rows[0]?.summary ?? undefined;
      keywords = rows[0]?.keywords ?? undefined;
    }

    const promptOverride = await getPromptTemplateBody(tx, {
      id: payload.prompt_template_id,
      agentType: 'copywriter',
    });

    const copy = await runCopywriterAgent(
      log,
      {
        workflow: 'generate-text',
        agent: 'copywriter',
        org_id,
        brand_id,
        campaign_id,
        content_item_id: payload.content_item_id,
      },
      {
        platform: payload.platform,
        contentType: payload.content_type,
        language: payload.language,
        brandContext: brandContextLine(brand),
        brandPrefix: brandPrefix(brand, org_id),
        researchSummary,
        keywords,
        negativePrompt: brand.negativePrompt ?? undefined,
        promptOverride,
      },
    );

    // Create or update the content item.
    let contentItemId = payload.content_item_id;
    if (contentItemId) {
      const existing = await getContentItem(tx, contentItemId);
      if (!existing) throw new TerminalError(`content_item not found: ${contentItemId}`);
      await setContentStatus(tx, contentItemId, 'generating', {
        title: copy.title || existing.title,
        body: copy.body,
        caption: copy.caption,
        hashtags: copy.hashtags,
        version: (existing.version ?? 1) + (payload.attempt_reason === 'regeneration' ? 1 : 0),
        generatedAt: new Date(),
      });
    } else {
      const inserted = await tx
        .insert(contentItems)
        .values({
          orgId: org_id,
          brandId: brand_id,
          campaignId: campaign_id ?? null,
          platform: payload.platform as Platform,
          contentType: payload.content_type as ContentType,
          language: payload.language,
          title: copy.title,
          body: copy.body,
          caption: copy.caption,
          hashtags: copy.hashtags,
          status: 'generating',
          version: 1,
          generatedAt: new Date(),
        })
        .returning({ id: contentItems.id });
      contentItemId = inserted[0]?.id as string;
    }

    // Fan-in readiness (image may already exist on a regen path).
    const item = await getContentItem(tx, contentItemId);
    const readyForReview = item ? await isReadyForReview(tx, item) : false;

    return { contentItemId, imageSeed: copy.caption || copy.body, readyForReview };
  });

  // Parallel branch: craft + generate an accompanying image. On the initial pass
  // we always request an image; on regeneration we keep the existing image and
  // skip re-generating it unless there is none (readyForReview === false).
  if (payload.attempt_reason !== 'regeneration' || !result.readyForReview) {
    await enqueueGenerateImage({
      org_id,
      brand_id,
      campaign_id,
      content_item_id: result.contentItemId,
      // The image-prompt agent refines this; the raw caption seeds it.
      prompt: result.imageSeed || 'brand social image',
      count: 1,
      attempt_reason: payload.attempt_reason,
    });
  }

  // Fan-in: if the image is already ready, advance straight to review.
  if (result.readyForReview) {
    await enqueueReview({
      org_id,
      brand_id,
      campaign_id,
      content_item_id: result.contentItemId,
      threshold: 90,
      attempt_reason: payload.attempt_reason,
    });
  }

  log.info(
    { content_item_id: result.contentItemId, readyForReview: result.readyForReview },
    'generate-text complete',
  );
  return { content_item_id: result.contentItemId };
});
