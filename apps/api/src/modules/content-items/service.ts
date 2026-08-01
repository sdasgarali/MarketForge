/**
 * Content-items service. Read (filtered list + single) and `regenerate`, which
 * enqueues a `generate-text` job with attempt_reason='regeneration' so the
 * worker produces a fresh version (ADR-008 output versioning).
 */
import { and, asc, desc, eq, gte, inArray, isNotNull, lte, sql, type SQL } from 'drizzle-orm';
import { assets, contentItems, db, publishJobs, reviewResults, withTenant } from '@marketforge/db';
import type { AssetRow, PublishJobRow } from '@marketforge/db';
import { enqueue } from '@marketforge/queue';
import { createLogger } from '@marketforge/logger';
import type { ContentStatus, Platform } from '@marketforge/contracts';
import { NotFoundError } from '../../http/errors.js';
import { contentItemToDto } from '../../lib/mappers.js';
import { assetImageUrl } from '../../lib/assets.js';
import { buildComposite, reviewRowsToDtos } from '../../lib/reviews.js';
import type { PaginationQuery } from '../../lib/pagination.js';

const log = createLogger({ service: 'api', workflow: 'content-items' });

export interface ContentItemFilters {
  status?: ContentStatus;
  platform?: Platform;
  brandId?: string;
  campaignId?: string;
}

/** Manual content authoring input (the calendar editor). Characters + story
 *  prompts are stored under metadata (no schema churn). */
export interface ContentItemInput {
  brand_id: string;
  platform: Platform;
  content_type?: string;
  scheduled_date?: string; // YYYY-MM-DD
  slot_index?: number;
  language?: string;
  title?: string;
  body?: string;
  caption?: string;
  hashtags?: string[];
  characters?: string;
  story_prompt?: string;
  image_prompt?: string;
}

function mergeAuthoringMetadata(
  existing: Record<string, unknown> | null | undefined,
  input: Pick<ContentItemInput, 'characters' | 'story_prompt' | 'image_prompt'>,
): Record<string, unknown> | undefined {
  const md: Record<string, unknown> = { ...(existing ?? {}) };
  if (input.characters !== undefined) md.characters = input.characters;
  if (input.story_prompt !== undefined) md.story_prompt = input.story_prompt;
  if (input.image_prompt !== undefined) md.image_prompt = input.image_prompt;
  return Object.keys(md).length ? md : undefined;
}

function buildWhere(f: ContentItemFilters): SQL | undefined {
  const conds: SQL[] = [];
  if (f.status) conds.push(eq(contentItems.status, f.status));
  if (f.platform) conds.push(eq(contentItems.platform, f.platform));
  if (f.brandId) conds.push(eq(contentItems.brandId, f.brandId));
  if (f.campaignId) conds.push(eq(contentItems.campaignId, f.campaignId));
  if (conds.length === 0) return undefined;
  return conds.length === 1 ? conds[0] : and(...conds);
}

type Tx = Parameters<Parameters<typeof withTenant>[2]>[0];

/**
 * For a set of content-item ids, resolve the join-derived DTO extras the web
 * consumes: `scheduled_at` (earliest pending/publishing publish_job) and
 * `image_url` (newest ready image asset). One query each; empty-safe.
 */
async function loadExtras(
  tx: Tx,
  ids: string[],
): Promise<Map<string, { scheduled_at?: Date | null; image_url?: string }>> {
  const out = new Map<string, { scheduled_at?: Date | null; image_url?: string }>();
  if (ids.length === 0) return out;

  const jobs = (await tx
    .select({
      contentItemId: publishJobs.contentItemId,
      scheduledAt: publishJobs.scheduledAt,
      status: publishJobs.status,
    })
    .from(publishJobs)
    .where(inArray(publishJobs.contentItemId, ids))
    .orderBy(publishJobs.scheduledAt)) as Pick<
    PublishJobRow,
    'contentItemId' | 'scheduledAt' | 'status'
  >[];
  for (const j of jobs) {
    if (!j.contentItemId) continue;
    const cur = out.get(j.contentItemId) ?? {};
    // Prefer the first (earliest) scheduled time we see per item.
    if (cur.scheduled_at == null && j.scheduledAt) cur.scheduled_at = j.scheduledAt;
    out.set(j.contentItemId, cur);
  }

  const imgs = (await tx
    .select({
      contentItemId: assets.contentItemId,
      driveFileId: assets.driveFileId,
      storageKey: assets.storageKey,
      createdAt: assets.createdAt,
    })
    .from(assets)
    .where(
      and(inArray(assets.contentItemId, ids), eq(assets.kind, 'image'), eq(assets.status, 'ready')),
    )
    .orderBy(desc(assets.createdAt))) as Pick<
    AssetRow,
    'contentItemId' | 'driveFileId' | 'storageKey' | 'createdAt'
  >[];
  for (const a of imgs) {
    if (!a.contentItemId) continue;
    const cur = out.get(a.contentItemId) ?? {};
    if (cur.image_url == null) {
      const url = assetImageUrl(a);
      if (url) cur.image_url = url;
    }
    out.set(a.contentItemId, cur);
  }

  return out;
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

      const extras = await loadExtras(tx, rows.map((r) => r.id));
      const items = rows.map((r) => contentItemToDto(r, extras.get(r.id) ?? {}));
      return { items, total: Number(count) };
    });
  },

  /**
   * Calendar view: every content item with a scheduled_date in [start,end],
   * optionally scoped to a brand/platform. Returns DTOs (with image_url) ordered
   * by date then slot — the web groups them into date × platform cells.
   */
  async calendar(
    orgId: string,
    opts: { brandId?: string; platform?: Platform; start: string; end: string },
  ) {
    return withTenant(db, orgId, async (tx) => {
      const conds: SQL[] = [
        isNotNull(contentItems.scheduledDate),
        gte(contentItems.scheduledDate, opts.start),
        lte(contentItems.scheduledDate, opts.end),
      ];
      if (opts.brandId) conds.push(eq(contentItems.brandId, opts.brandId));
      if (opts.platform) conds.push(eq(contentItems.platform, opts.platform));
      const rows = await tx
        .select()
        .from(contentItems)
        .where(and(...conds))
        .orderBy(asc(contentItems.scheduledDate), asc(contentItems.slotIndex));
      const extras = await loadExtras(tx, rows.map((r) => r.id));
      return { items: rows.map((r) => contentItemToDto(r, extras.get(r.id) ?? {})) };
    });
  },

  /** Manually create a content item for a calendar cell (date × platform). */
  async create(orgId: string, input: ContentItemInput) {
    return withTenant(db, orgId, async (tx) => {
      const [row] = await tx
        .insert(contentItems)
        .values({
          orgId,
          brandId: input.brand_id,
          platform: input.platform,
          contentType: input.content_type ?? 'post',
          language: input.language ?? 'en',
          title: input.title ?? null,
          body: input.body ?? null,
          caption: input.caption ?? null,
          hashtags: input.hashtags ?? null,
          scheduledDate: input.scheduled_date ?? null,
          slotIndex: input.slot_index ?? 0,
          metadata: (mergeAuthoringMetadata(null, input) ?? null) as never,
          status: 'draft',
        })
        .returning();
      if (!row) throw new Error('failed to create content item');
      return contentItemToDto(row);
    });
  },

  /** Manually edit a content item (calendar editor: text, schedule, chars, prompts). */
  async update(orgId: string, id: string, input: Partial<ContentItemInput>) {
    return withTenant(db, orgId, async (tx) => {
      const [existing] = await tx
        .select()
        .from(contentItems)
        .where(eq(contentItems.id, id))
        .limit(1);
      if (!existing) throw new NotFoundError(`Content item ${id} not found`);
      const patch: Record<string, unknown> = { updatedAt: new Date() };
      if (input.platform !== undefined) patch.platform = input.platform;
      if (input.content_type !== undefined) patch.contentType = input.content_type;
      if (input.language !== undefined) patch.language = input.language;
      if (input.title !== undefined) patch.title = input.title;
      if (input.body !== undefined) patch.body = input.body;
      if (input.caption !== undefined) patch.caption = input.caption;
      if (input.hashtags !== undefined) patch.hashtags = input.hashtags;
      if (input.scheduled_date !== undefined) patch.scheduledDate = input.scheduled_date;
      if (input.slot_index !== undefined) patch.slotIndex = input.slot_index;
      const md = mergeAuthoringMetadata(
        (existing.metadata as Record<string, unknown> | null) ?? null,
        input,
      );
      if (md) patch.metadata = md;
      const [row] = await tx
        .update(contentItems)
        .set(patch as never)
        .where(eq(contentItems.id, id))
        .returning();
      if (!row) throw new NotFoundError(`Content item ${id} not found`);
      return contentItemToDto(row);
    });
  },

  /**
   * Single content item plus its AI review verdict. Returns the shape the web
   * detail drawer consumes: `{ item, composite, reviews }`.
   */
  async get(orgId: string, id: string) {
    return withTenant(db, orgId, async (tx) => {
      const [row] = await tx.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
      if (!row) throw new NotFoundError(`Content item ${id} not found`);

      const extras = await loadExtras(tx, [row.id]);
      const item = contentItemToDto(row, extras.get(row.id) ?? {});

      const reviewRows = await tx
        .select()
        .from(reviewResults)
        .where(eq(reviewResults.contentItemId, id))
        .orderBy(reviewResults.createdAt);

      const composite = buildComposite(id, reviewRows, {
        fallbackScore: row.qualityScore == null ? null : Number(row.qualityScore),
      });
      return { item, composite, reviews: reviewRowsToDtos(reviewRows) };
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
