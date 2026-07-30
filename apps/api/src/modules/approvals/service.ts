/**
 * Approval-queue service — the core human/AI gate (CLAUDE.md hard constraint:
 * never publish immediately; per-brand trust tiers). On approve it applies the
 * publishingPolicy decision:
 *   - auto-schedule    → Scheduler.scheduleAt('publish', ...) at the item's
 *                        scheduled time (backend owns the clock, ADR-004),
 *                        content status → 'scheduled'.
 *   - require-approval → content status → 'approved' (awaits an explicit
 *                        scheduled_at / further action; not auto-published).
 *   - block            → treated as a failed gate; caller should regenerate.
 * On reject: content status → 'failed' with the reason recorded.
 *
 * Every DB access is tenant-scoped through withTenant.
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { Platform, TrustTier } from '@marketforge/contracts';
import {
  assets,
  brands,
  contentItems,
  db,
  publishJobs,
  reviewResults,
  withTenant,
} from '@marketforge/db';
import type { AssetRow, PublishJobRow, ReviewResultRow } from '@marketforge/db';
import { scheduler } from '@marketforge/queue';
import { createLogger } from '@marketforge/logger';
import { ConflictError, NotFoundError } from '../../http/errors.js';
import { contentItemToDto } from '../../lib/mappers.js';
import { assetImageUrl } from '../../lib/assets.js';
import { buildComposite, reviewRowsToDtos } from '../../lib/reviews.js';
import type { PaginationQuery } from '../../lib/pagination.js';
import { decidePublishing, type ApprovalPolicyInput } from './publishing-policy.js';

const log = createLogger({ service: 'api', workflow: 'approvals' });

/** Content statuses that appear in the approval queue. */
const QUEUE_STATUSES = ['review', 'approved'] as const;

const DEFAULT_APPROVAL: ApprovalPolicyInput = { mode: 'manual', min_score: 90, trust_tier: 'new' };

/** Extract approval settings + trust tier from a brand's jsonb column, safely. */
function readBrandPolicy(approvalSettings: unknown): { approval: ApprovalPolicyInput; tier: TrustTier } {
  const a = (approvalSettings ?? {}) as Partial<ApprovalPolicyInput>;
  const approval: ApprovalPolicyInput = {
    mode: a.mode === 'auto' ? 'auto' : 'manual',
    min_score: typeof a.min_score === 'number' ? a.min_score : DEFAULT_APPROVAL.min_score,
    trust_tier: (a.trust_tier as TrustTier) ?? 'new',
  };
  return { approval, tier: approval.trust_tier };
}

/** Composite score for an item: prefer stored quality_score, else average of review results. */
async function compositeScore(
  tx: Parameters<Parameters<typeof withTenant>[2]>[0],
  contentItemId: string,
  fallback: number | null,
): Promise<number> {
  if (fallback != null && Number.isFinite(fallback)) return fallback;
  const [agg] = await tx
    .select({ avg: sql<number>`coalesce(avg(${reviewResults.score}), 0)::float` })
    .from(reviewResults)
    .where(eq(reviewResults.contentItemId, contentItemId));
  return Number(agg?.avg ?? 0);
}

export const approvalsService = {
  /**
   * List approval-queue rows (status review or approved-pending). Each row is an
   * ApprovalItem the web renders: `{ content_item, composite, reviews, brand_name }`.
   * Joins in the brand name, per-item review results (→ composite verdict), the
   * item's scheduled time (publish_job) and primary image (asset).
   */
  async list(orgId: string, page: PaginationQuery) {
    return withTenant(db, orgId, async (tx) => {
      const rows = await tx
        .select({ item: contentItems, brand_name: brands.companyName })
        .from(contentItems)
        .leftJoin(brands, eq(contentItems.brandId, brands.id))
        .where(inArray(contentItems.status, [...QUEUE_STATUSES]))
        .orderBy(desc(contentItems.updatedAt))
        .limit(page.limit)
        .offset(page.offset);
      const [{ count } = { count: 0 }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(contentItems)
        .where(inArray(contentItems.status, [...QUEUE_STATUSES]));

      const ids = rows.map((r) => r.item.id);

      // Review results per item (for the per-check breakdown + composite).
      const reviewsByItem = new Map<string, ReviewResultRow[]>();
      if (ids.length > 0) {
        const reviewRows = (await tx
          .select()
          .from(reviewResults)
          .where(inArray(reviewResults.contentItemId, ids))
          .orderBy(reviewResults.createdAt)) as ReviewResultRow[];
        for (const rr of reviewRows) {
          const list = reviewsByItem.get(rr.contentItemId) ?? [];
          list.push(rr);
          reviewsByItem.set(rr.contentItemId, list);
        }
      }

      // Scheduled time (publish_jobs) + primary image (assets) per item.
      const scheduledByItem = new Map<string, Date>();
      const imageByItem = new Map<string, string>();
      if (ids.length > 0) {
        const jobs = (await tx
          .select({
            contentItemId: publishJobs.contentItemId,
            scheduledAt: publishJobs.scheduledAt,
          })
          .from(publishJobs)
          .where(inArray(publishJobs.contentItemId, ids))
          .orderBy(publishJobs.scheduledAt)) as Pick<
          PublishJobRow,
          'contentItemId' | 'scheduledAt'
        >[];
        for (const j of jobs) {
          if (j.contentItemId && j.scheduledAt && !scheduledByItem.has(j.contentItemId)) {
            scheduledByItem.set(j.contentItemId, j.scheduledAt);
          }
        }
        const imgs = (await tx
          .select({
            contentItemId: assets.contentItemId,
            driveFileId: assets.driveFileId,
            storageKey: assets.storageKey,
          })
          .from(assets)
          .where(
            and(
              inArray(assets.contentItemId, ids),
              eq(assets.kind, 'image'),
              eq(assets.status, 'ready'),
            ),
          )
          .orderBy(desc(assets.createdAt))) as Pick<
          AssetRow,
          'contentItemId' | 'driveFileId' | 'storageKey'
        >[];
        for (const a of imgs) {
          if (a.contentItemId && !imageByItem.has(a.contentItemId)) {
            const url = assetImageUrl(a);
            if (url) imageByItem.set(a.contentItemId, url);
          }
        }
      }

      const items = rows.map((r) => {
        const reviewRows = reviewsByItem.get(r.item.id) ?? [];
        const content_item = contentItemToDto(r.item, {
          scheduled_at: scheduledByItem.get(r.item.id) ?? null,
          image_url: imageByItem.get(r.item.id) ?? null,
        });
        const composite = buildComposite(r.item.id, reviewRows, {
          fallbackScore: r.item.qualityScore == null ? null : Number(r.item.qualityScore),
        });
        return {
          content_item,
          composite,
          reviews: reviewRowsToDtos(reviewRows),
          brand_name: r.brand_name ?? '—',
        };
      });

      return { items, total: Number(count) };
    });
  },

  /**
   * Approve a content item. Applies the trust-tier + score gate and either
   * schedules a publish or leaves it approved-awaiting-schedule.
   *
   * @param threshold caller-supplied gate threshold (default 90).
   * @param scheduledAt optional ISO instant to publish at (with offset/Z).
   */
  async approve(
    orgId: string,
    id: string,
    opts: { threshold?: number; scheduledAt?: string; timezone?: string },
  ) {
    // Phase 1 (tx): load item + brand policy, compute score, decide, update status.
    const decisionCtx = await withTenant(db, orgId, async (tx) => {
      const [item] = await tx.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
      if (!item) throw new NotFoundError(`Content item ${id} not found`);
      if (item.status !== 'review' && item.status !== 'approved') {
        throw new ConflictError(`Content item ${id} is not awaiting approval (status=${item.status})`);
      }

      const [brand] = await tx
        .select({ approvalSettings: brands.approvalSettings })
        .from(brands)
        .where(eq(brands.id, item.brandId))
        .limit(1);
      if (!brand) throw new NotFoundError(`Brand ${item.brandId} not found`);

      const { approval, tier } = readBrandPolicy(brand.approvalSettings);
      const threshold = opts.threshold ?? approval.min_score;
      const score = await compositeScore(tx, id, item.qualityScore == null ? null : Number(item.qualityScore));

      const decision = decidePublishing({
        trustTier: tier,
        compositeScore: score,
        threshold,
        approvalSettings: approval,
      });

      // Apply the resulting content status inside the same tx.
      const nextStatus = decision.decision === 'auto-schedule' ? 'scheduled' : 'approved';
      if (decision.decision !== 'block') {
        await tx
          .update(contentItems)
          .set({ status: nextStatus, updatedAt: new Date() })
          .where(eq(contentItems.id, id));
      }

      return { item, decision, tier, score };
    });

    const { item, decision } = decisionCtx;

    // Phase 2 (outside tx): if auto-schedule, wire the backend-owned Scheduler.
    let scheduled: { jobId: string; run_at: string } | undefined;
    if (decision.decision === 'auto-schedule') {
      const at = opts.scheduledAt ?? new Date().toISOString();
      const result = await scheduler.scheduleAt(
        'publish',
        {
          org_id: orgId,
          brand_id: item.brandId,
          campaign_id: item.campaignId ?? undefined,
          content_item_id: id,
          platforms: [(item.platform as Platform) ?? 'x'],
          scheduled_at: at,
          attempt_reason: 'initial',
        },
        opts.timezone ? { at, timezone: opts.timezone } : { at },
      );
      scheduled = { jobId: result.jobId, run_at: result.targetInstantISO };
    }

    log.info(
      { org_id: orgId, content_item_id: id, decision: decision.decision, score: decisionCtx.score },
      'approval decision applied',
    );

    return {
      content_item_id: id,
      decision: decision.decision,
      reason: decision.reason,
      composite_score: decisionCtx.score,
      trust_tier: decisionCtx.tier,
      scheduled,
    };
  },

  /** Reject a content item: status → failed with a reason recorded in metadata. */
  async reject(orgId: string, id: string, reason: string) {
    return withTenant(db, orgId, async (tx) => {
      const [item] = await tx.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
      if (!item) throw new NotFoundError(`Content item ${id} not found`);
      if (item.status !== 'review' && item.status !== 'approved') {
        throw new ConflictError(`Content item ${id} is not awaiting approval (status=${item.status})`);
      }
      const meta = { ...((item.metadata as Record<string, unknown>) ?? {}), rejection_reason: reason };
      const [row] = await tx
        .update(contentItems)
        .set({ status: 'failed', metadata: meta as never, updatedAt: new Date() })
        .where(and(eq(contentItems.id, id)))
        .returning();
      return { content_item_id: id, status: 'failed' as const, reason, item: contentItemToDto(row!) };
    });
  },
};
