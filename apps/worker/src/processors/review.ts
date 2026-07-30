/**
 * review processor — Stage 4. Multi-check AI reviewer computes a composite
 * score, persists per-stage `review_results`, and gates the pipeline:
 *
 *   - composite PASSES (>= threshold)  → content_item.status = 'review'
 *       (awaiting HUMAN approval; the API flips it to 'approved'/'scheduled'
 *        and enqueues the publish job — the worker does NOT auto-publish).
 *   - composite FAILS and regen attempts remain (cap MAX_REGEN_ATTEMPTS)
 *       → enqueue `generate-text` with attempt_reason='regeneration'.
 *   - composite FAILS and regen exhausted
 *       → content_item.status = 'review' anyway (human decides), flagged low-score.
 *
 * Regen count is tracked in content_item.metadata.regen_count.
 *
 * NEXT STAGE: (human approval → API-scheduled publish) OR generate-text (regen).
 */
import { enqueueGenerateText } from '@marketforge/queue';
import { db, withTenant, reviewResults } from '@marketforge/db';
import type { ReviewStage } from '@marketforge/contracts';
import { defineProcessor } from './base.js';
import { TerminalError } from '../lib/errors.js';
import { MAX_REGEN_ATTEMPTS } from '../lib/constants.js';
import { getBrand, brandContextLine } from '../lib/brand.js';
import { getContentItem, setContentStatus } from '../lib/content.js';
import { writeAudit } from '../lib/audit.js';
import { DEFAULT_REVIEW_STAGES, runReviewerAgent } from '../agents/reviewer.agent.js';

function readRegenCount(metadata: unknown): number {
  if (metadata && typeof metadata === 'object' && 'regen_count' in metadata) {
    const v = (metadata as { regen_count?: unknown }).regen_count;
    return typeof v === 'number' ? v : 0;
  }
  return 0;
}

export const reviewProcessor = defineProcessor('review', async ({ payload, log }) => {
  const { org_id, brand_id, campaign_id, content_item_id, threshold } = payload;

  const outcome = await withTenant(db, org_id, async (tx) => {
    const item = await getContentItem(tx, content_item_id);
    if (!item) throw new TerminalError(`content_item not found: ${content_item_id}`);
    if (!item.brandId) throw new TerminalError('content_item missing brand_id');
    const brand = await getBrand(tx, item.brandId);

    const stages = (payload.stages && payload.stages.length > 0
      ? payload.stages
      : DEFAULT_REVIEW_STAGES) as ReviewStage[];

    const { composite, details } = await runReviewerAgent(
      log,
      { workflow: 'review', agent: 'reviewer', org_id, brand_id: item.brandId, campaign_id, content_item_id },
      {
        stages,
        threshold,
        brandContext: brandContextLine(brand),
        content: {
          title: item.title ?? undefined,
          body: item.body ?? undefined,
          caption: item.caption ?? undefined,
          hashtags: item.hashtags ?? undefined,
        },
      },
    );

    // Persist one review_results row per stage.
    for (const d of details) {
      await tx.insert(reviewResults).values({
        orgId: org_id,
        contentItemId: content_item_id,
        stage: d.stage,
        agent: `reviewer:${d.stage}`,
        score: String(d.score),
        passed: d.passed,
        findings: (d.findings ?? null) as unknown,
        model: d.model,
        tokens: d.tokens,
        costUsd: String(d.costUsd),
      });
    }

    const regenCount = readRegenCount(item.metadata);
    const canRegen = !composite.passed && regenCount < MAX_REGEN_ATTEMPTS;

    if (composite.passed) {
      // Passed → hold for HUMAN approval (per-brand trust tier is enforced by
      // the API's approval flow; the worker never auto-publishes).
      await setContentStatus(tx, content_item_id, 'review', {
        qualityScore: String(composite.composite_score),
      });
      await writeAudit(tx, org_id, {
        action: 'content.review_passed',
        entityType: 'content_item',
        entityId: content_item_id,
        after: { composite_score: composite.composite_score } as unknown as never,
      });
    } else if (canRegen) {
      const nextMeta = {
        ...(typeof item.metadata === 'object' && item.metadata ? item.metadata : {}),
        regen_count: regenCount + 1,
      };
      await setContentStatus(tx, content_item_id, 'generating', {
        qualityScore: String(composite.composite_score),
        metadata: nextMeta as unknown,
      });
      await writeAudit(tx, org_id, {
        action: 'content.review_failed_regen',
        entityType: 'content_item',
        entityId: content_item_id,
        after: {
          composite_score: composite.composite_score,
          failed_stages: composite.failed_stages,
          regen_count: regenCount + 1,
        } as unknown as never,
      });
    } else {
      // Failed but regen exhausted → still surface to human (low score flagged).
      await setContentStatus(tx, content_item_id, 'review', {
        qualityScore: String(composite.composite_score),
      });
      await writeAudit(tx, org_id, {
        action: 'content.review_failed_exhausted',
        entityType: 'content_item',
        entityId: content_item_id,
        after: {
          composite_score: composite.composite_score,
          failed_stages: composite.failed_stages,
        } as unknown as never,
      });
    }

    return {
      passed: composite.passed,
      canRegen,
      score: composite.composite_score,
      platform: item.platform,
      contentType: item.contentType,
      language: item.language,
    };
  });

  // Trigger regeneration OUTSIDE the tx (enqueue is not transactional).
  if (!outcome.passed && outcome.canRegen) {
    await enqueueGenerateText({
      org_id,
      brand_id,
      campaign_id,
      content_item_id,
      platform: (outcome.platform as never) ?? 'x',
      content_type: outcome.contentType ?? 'post',
      language: outcome.language ?? 'en',
      attempt_reason: 'regeneration',
    });
    log.info({ content_item_id, score: outcome.score }, 'review failed; enqueued regeneration');
  } else {
    log.info(
      { content_item_id, score: outcome.score, passed: outcome.passed },
      'review complete; content_item awaiting human approval',
    );
  }

  return { passed: outcome.passed, score: outcome.score };
});
