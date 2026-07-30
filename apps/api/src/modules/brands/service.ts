/**
 * Brands service — all access tenant-scoped via withTenant (ADR-001). Translates
 * between the BrandCreateInput contract and Drizzle insert rows, and returns
 * mapped DTOs. Never touches the DB outside withTenant.
 */
import { and, desc, eq, sql } from 'drizzle-orm';
import type { BrandCreateInput } from '@marketforge/contracts';
import { brands, db, withTenant } from '@marketforge/db';
import type { BrandInsert } from '@marketforge/db';
import { NotFoundError } from '../../http/errors.js';
import { brandToDto } from '../../lib/mappers.js';
import type { PaginationQuery } from '../../lib/pagination.js';

/** Map a validated create/update contract input to a Drizzle insert row. */
function toInsertRow(orgId: string, input: BrandCreateInput): Omit<BrandInsert, 'id'> {
  return {
    orgId,
    companyName: input.company_name,
    website: input.website ?? null,
    industry: input.industry ?? null,
    products: (input.products ?? []) as never,
    services: (input.services ?? []) as never,
    mission: input.mission ?? null,
    vision: input.vision ?? null,
    targetAudience: (input.target_audience ?? null) as never,
    competitors: (input.competitors ?? []) as never,
    logoAssetId: input.logo_asset_id ?? null,
    brandColors: (input.brand_colors ?? null) as never,
    fonts: (input.fonts ?? []) as never,
    icons: (input.icons ?? null) as never,
    brandVoice: input.brand_voice ?? null,
    writingStyle: input.writing_style ?? null,
    preferredCta: input.preferred_cta ?? null,
    negativePrompt: input.negative_prompt ?? null,
    imageStyle: input.image_style ?? null,
    videoStyle: input.video_style ?? null,
    approvedCharacters: (input.approved_characters ?? []) as never,
    timezone: input.timezone ?? 'UTC',
    languages: input.languages ?? ['en'],
    driveFolderId: input.drive_folder_id ?? null,
    publishingSchedule: (input.publishing_schedule ?? null) as never,
    approvalSettings: (input.approval_settings ?? {
      mode: 'manual',
      min_score: 90,
      trust_tier: 'new',
    }) as never,
    knowledgeBase: (input.knowledge_base ?? null) as never,
    status: input.status ?? 'active',
  };
}

export const brandsService = {
  async list(orgId: string, page: PaginationQuery) {
    return withTenant(db, orgId, async (tx) => {
      const rows = await tx
        .select()
        .from(brands)
        .orderBy(desc(brands.createdAt))
        .limit(page.limit)
        .offset(page.offset);
      const [{ count } = { count: 0 }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(brands);
      return { items: rows.map(brandToDto), total: Number(count) };
    });
  },

  async get(orgId: string, id: string) {
    return withTenant(db, orgId, async (tx) => {
      const [row] = await tx.select().from(brands).where(eq(brands.id, id)).limit(1);
      if (!row) throw new NotFoundError(`Brand ${id} not found`);
      return brandToDto(row);
    });
  },

  async create(orgId: string, input: BrandCreateInput) {
    return withTenant(db, orgId, async (tx) => {
      const [row] = await tx
        .insert(brands)
        .values(toInsertRow(orgId, input))
        .returning();
      // RLS guarantees the row is org-scoped; returning() cannot be empty here.
      return brandToDto(row!);
    });
  },

  async update(orgId: string, id: string, input: BrandCreateInput) {
    return withTenant(db, orgId, async (tx) => {
      const { orgId: _drop, ...set } = toInsertRow(orgId, input);
      const [row] = await tx
        .update(brands)
        .set({ ...set, updatedAt: new Date() })
        .where(eq(brands.id, id))
        .returning();
      if (!row) throw new NotFoundError(`Brand ${id} not found`);
      return brandToDto(row);
    });
  },

  async remove(orgId: string, id: string) {
    return withTenant(db, orgId, async (tx) => {
      const [row] = await tx
        .delete(brands)
        .where(and(eq(brands.id, id)))
        .returning({ id: brands.id });
      if (!row) throw new NotFoundError(`Brand ${id} not found`);
      return { id: row.id };
    });
  },
};

export type BrandsService = typeof brandsService;
