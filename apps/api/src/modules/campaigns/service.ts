/**
 * Campaigns service. CRUD + `start`, which kicks off the content pipeline by
 * enqueuing jobs for the campaign's planned content. The API only decides
 * *what/when* and enqueues (ADR-004/005/008) — workers do the AI/external work.
 *
 * start() flow:
 *   - Load campaign + brand (tenant-scoped).
 *   - For each planned content_item in status 'draft'/'researching', enqueue a
 *     `research` job (topic/platform from the item/campaign). If a research
 *     report already exists on the item's campaign, skip straight to
 *     `generate-text`. (MVP: enqueue research; worker chains to generate-text.)
 *   - If the campaign has no planned items yet, enqueue a single research job at
 *     the campaign level so the pipeline can seed content.
 *   - Mark the campaign 'queued'.
 */
import { and, desc, eq, inArray, sql } from 'drizzle-orm';
import type { CampaignCreateInput } from '@marketforge/contracts';
import { brands, campaigns, contentItems, db, withTenant } from '@marketforge/db';
import type { CampaignInsert } from '@marketforge/db';
import { enqueue } from '@marketforge/queue';
import { createLogger } from '@marketforge/logger';
import { ConflictError, NotFoundError } from '../../http/errors.js';
import { campaignToDto } from '../../lib/mappers.js';
import type { PaginationQuery } from '../../lib/pagination.js';

const log = createLogger({ service: 'api', workflow: 'campaigns' });

/** Content statuses that are still "planned" (not yet generated). */
const PLANNED_STATUSES = ['draft', 'researching'] as const;

function toInsertRow(orgId: string, input: CampaignCreateInput): Omit<CampaignInsert, 'id'> {
  return {
    orgId,
    brandId: input.brand_id,
    name: input.name,
    campaignType: input.campaign_type,
    platform: input.platform ?? null,
    topic: input.topic ?? null,
    priority: input.priority ?? 5,
    language: input.language ?? 'en',
    timezone: input.timezone ?? 'UTC',
    schedule: (input.schedule ?? null) as never,
    runAt: input.run_at ? new Date(input.run_at) : null,
    approvalRequired: input.approval_required ?? true,
    autoMode: input.auto_mode ?? false,
    createdBy: input.created_by ?? null,
  };
}

export const campaignsService = {
  async list(orgId: string, page: PaginationQuery) {
    return withTenant(db, orgId, async (tx) => {
      const rows = await tx
        .select()
        .from(campaigns)
        .orderBy(desc(campaigns.createdAt))
        .limit(page.limit)
        .offset(page.offset);
      const [{ count } = { count: 0 }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(campaigns);
      return { items: rows.map(campaignToDto), total: Number(count) };
    });
  },

  async get(orgId: string, id: string) {
    return withTenant(db, orgId, async (tx) => {
      const [row] = await tx.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
      if (!row) throw new NotFoundError(`Campaign ${id} not found`);
      return campaignToDto(row);
    });
  },

  async create(orgId: string, input: CampaignCreateInput) {
    return withTenant(db, orgId, async (tx) => {
      // Ensure the referenced brand belongs to this tenant (RLS also enforces).
      const [brand] = await tx.select({ id: brands.id }).from(brands).where(eq(brands.id, input.brand_id)).limit(1);
      if (!brand) throw new NotFoundError(`Brand ${input.brand_id} not found`);
      const [row] = await tx.insert(campaigns).values(toInsertRow(orgId, input)).returning();
      return campaignToDto(row!);
    });
  },

  async update(orgId: string, id: string, input: CampaignCreateInput) {
    return withTenant(db, orgId, async (tx) => {
      const { orgId: _drop, ...set } = toInsertRow(orgId, input);
      const [row] = await tx
        .update(campaigns)
        .set({ ...set, updatedAt: new Date() })
        .where(eq(campaigns.id, id))
        .returning();
      if (!row) throw new NotFoundError(`Campaign ${id} not found`);
      return campaignToDto(row);
    });
  },

  async remove(orgId: string, id: string) {
    return withTenant(db, orgId, async (tx) => {
      const [row] = await tx.delete(campaigns).where(eq(campaigns.id, id)).returning({ id: campaigns.id });
      if (!row) throw new NotFoundError(`Campaign ${id} not found`);
      return { id: row.id };
    });
  },

  /**
   * Start a campaign: enqueue the pipeline. Returns the enqueued job ids and the
   * updated campaign. Idempotency keys derive from campaign + item so a repeated
   * start doesn't double-enqueue the same logical work.
   */
  async start(orgId: string, id: string) {
    // Read campaign + planned items inside a tenant transaction, flip status.
    const { campaign, planned } = await withTenant(db, orgId, async (tx) => {
      const [row] = await tx.select().from(campaigns).where(eq(campaigns.id, id)).limit(1);
      if (!row) throw new NotFoundError(`Campaign ${id} not found`);
      if (row.status === 'running' || row.status === 'queued') {
        throw new ConflictError(`Campaign ${id} is already ${row.status}`);
      }

      const items = await tx
        .select()
        .from(contentItems)
        .where(
          and(
            eq(contentItems.campaignId, id),
            inArray(contentItems.status, [...PLANNED_STATUSES]),
          ),
        );

      await tx.update(campaigns).set({ status: 'queued', updatedAt: new Date() }).where(eq(campaigns.id, id));
      return { campaign: row, planned: items };
    });

    // Enqueue outside the DB transaction (don't hold a tx open across Redis I/O).
    const jobIds: string[] = [];
    const brandId = campaign.brandId;

    if (planned.length === 0) {
      // No planned items: seed the pipeline with one campaign-level research job.
      const jobId = await enqueue('research', {
        org_id: orgId,
        brand_id: brandId,
        campaign_id: id,
        idempotency_key: `research:${id}:seed`,
        attempt_reason: 'initial',
        topic: campaign.topic ?? undefined,
        platform: (campaign.platform as never) ?? undefined,
      });
      jobIds.push(jobId);
    } else {
      for (const item of planned) {
        const jobId = await enqueue('research', {
          org_id: orgId,
          brand_id: brandId,
          campaign_id: id,
          idempotency_key: `research:${id}:${item.id}`,
          attempt_reason: 'initial',
          topic: campaign.topic ?? undefined,
          platform: (item.platform as never) ?? (campaign.platform as never) ?? undefined,
        });
        jobIds.push(jobId);
      }
    }

    log.info({ org_id: orgId, campaign_id: id, brand_id: brandId, enqueued: jobIds.length }, 'campaign started');

    const updated = await this.get(orgId, id);
    return { campaign: updated, enqueued_jobs: jobIds };
  },
};
