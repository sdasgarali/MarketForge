/**
 * Prompt-templates service. Tenant-scoped CRUD (RLS excludes global org_id-null
 * templates from normal reads per db/ops.ts note — those are admin-managed).
 */
import { desc, eq, sql } from 'drizzle-orm';
import { z } from 'zod';
import { AgentType, Uuid } from '@marketforge/contracts';
import { db, promptTemplates, withTenant } from '@marketforge/db';
import { NotFoundError } from '../../http/errors.js';
import { promptTemplateToDto } from '../../lib/mappers.js';
import type { PaginationQuery } from '../../lib/pagination.js';

export const PromptTemplateInput = z.object({
  name: z.string().min(1),
  agent_type: AgentType,
  body: z.string().min(1),
  brand_id: Uuid.optional(),
  version: z.number().int().positive().optional(),
  variables: z.unknown().optional(),
  is_active: z.boolean().optional(),
});
export type PromptTemplateInput = z.infer<typeof PromptTemplateInput>;

export const promptTemplatesService = {
  async list(orgId: string, page: PaginationQuery) {
    return withTenant(db, orgId, async (tx) => {
      const rows = await tx
        .select()
        .from(promptTemplates)
        .orderBy(desc(promptTemplates.createdAt))
        .limit(page.limit)
        .offset(page.offset);
      const [{ count } = { count: 0 }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(promptTemplates);
      return { items: rows.map(promptTemplateToDto), total: Number(count) };
    });
  },

  async get(orgId: string, id: string) {
    return withTenant(db, orgId, async (tx) => {
      const [row] = await tx.select().from(promptTemplates).where(eq(promptTemplates.id, id)).limit(1);
      if (!row) throw new NotFoundError(`Prompt template ${id} not found`);
      return promptTemplateToDto(row);
    });
  },

  async create(orgId: string, input: PromptTemplateInput) {
    return withTenant(db, orgId, async (tx) => {
      const [row] = await tx
        .insert(promptTemplates)
        .values({
          orgId,
          brandId: input.brand_id ?? null,
          name: input.name,
          agentType: input.agent_type,
          version: input.version ?? 1,
          body: input.body,
          variables: (input.variables ?? null) as never,
          isActive: input.is_active ?? true,
        })
        .returning();
      return promptTemplateToDto(row!);
    });
  },

  async update(orgId: string, id: string, input: PromptTemplateInput) {
    return withTenant(db, orgId, async (tx) => {
      const [row] = await tx
        .update(promptTemplates)
        .set({
          brandId: input.brand_id ?? null,
          name: input.name,
          agentType: input.agent_type,
          version: input.version ?? 1,
          body: input.body,
          variables: (input.variables ?? null) as never,
          isActive: input.is_active ?? true,
          updatedAt: new Date(),
        })
        .where(eq(promptTemplates.id, id))
        .returning();
      if (!row) throw new NotFoundError(`Prompt template ${id} not found`);
      return promptTemplateToDto(row);
    });
  },

  async remove(orgId: string, id: string) {
    return withTenant(db, orgId, async (tx) => {
      const [row] = await tx
        .delete(promptTemplates)
        .where(eq(promptTemplates.id, id))
        .returning({ id: promptTemplates.id });
      if (!row) throw new NotFoundError(`Prompt template ${id} not found`);
      return { id: row.id };
    });
  },
};
