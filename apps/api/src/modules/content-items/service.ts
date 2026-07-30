/**
 * Content-items service. Read (filtered list + single) and `regenerate`, which
 * enqueues a `generate-text` job with attempt_reason='regeneration' so the
 * worker produces a fresh version (ADR-008 output versioning).
 */
import { and, desc, eq, sql, type SQL } from 'drizzle-orm';
import { contentItems, db, withTenant } from '@marketforge/db';
import { enqueue } from '@marketforge/queue';
import { createLogger } from '@marketforge/logger';
import type { ContentStatus, Platform } from '@marketforge/contracts';
import { NotFoundError } from '../../http/errors.js';
import { contentItemToDto } from '../../lib/mappers.js';
import type { PaginationQuery } from '../../lib/pagination.js';

const log = createLogger({ service: 'api', workflow: 'content-items' });

export interface ContentItemFilters {
  status?: ContentStatus;
  brandId?: string;
  campaignId?: string;
}

function buildWhere(f: ContentItemFilters): SQL | undefined {
  const conds: SQL[] = [];
  if (f.status) conds.push(eq(contentItems.status, f.status));
  if (f.brandId) conds.push(eq(contentItems.brandId, f.brandId));
  if (f.campaignId) conds.push(eq(contentItems.campaignId, f.campaignId));
  if (conds.length === 0) return undefined;
  return conds.length === 1 ? conds[0] : and(...conds);
}

export const contentItemsService = {
  async list(orgId: string, filters: ContentItemFilters, page: PaginationQuery) {
    return withTenant(db, orgId, async (tx) => {
      const where = buildWhere(filters);
      const base = tx.select().from(contentItems).$dynamic();
      const rows = await (where ? base.where(where) : base)
        .orderBy(desc(contentItems.createdAt))
        .limit(page.limit)
        .offset(page.offset);

      const countBase = tx.select({ count: sql<number>`count(*)::int` }).from(contentItems).$dynamic();
      const [{ count } = { count: 0 }] = await (where ? countBase.where(where) : countBase);
      return { items: rows.map(contentItemToDto), total: Number(count) };
    });
  },

  async get(orgId: string, id: string) {
    return withTenant(db, orgId, async (tx) => {
      const [row] = await tx.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
      if (!row) throw new NotFoundError(`Content item ${id} not found`);
      return contentItemToDto(row);
    });
  },

  /** Enqueue a regeneration of a content item's text. */
  async regenerate(orgId: string, id: string) {
    const item = await withTenant(db, orgId, async (tx) => {
      const [row] = await tx.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
      if (!row) throw new NotFoundError(`Content item ${id} not found`);
      await tx
        .update(contentItems)
        .set({ status: 'generating', updatedAt: new Date() })
        .where(eq(contentItems.id, id));
      return row;
    });

    const jobId = await enqueue('generate-text', {
      org_id: orgId,
      brand_id: item.brandId,
      campaign_id: item.campaignId ?? undefined,
      content_item_id: id,
      platform: (item.platform as Platform) ?? 'x',
      content_type: item.contentType ?? 'post',
      language: item.language ?? 'en',
      attempt_reason: 'regeneration',
      idempotency_key: `generate-text:${id}:regen:${Date.now()}`,
    });

    log.info({ org_id: orgId, content_item_id: id, job_id: jobId }, 'content regeneration enqueued');
    return { content_item_id: id, job_id: jobId, status: 'generating' as const };
  },
};
