/**
 * Brand + prompt-template loading helpers (tenant-scoped). Agents use the brand
 * profile (voice, style, CTA, negative prompt) to condition generation, and an
 * optional DB prompt_template overrides the file-based default.
 */
import { and, eq } from 'drizzle-orm';
import { brands, promptTemplates, type TenantTx } from '@marketforge/db';

export type BrandRow = typeof brands.$inferSelect;

/** Load a brand row within the tenant transaction, or undefined. */
export async function getBrand(tx: TenantTx, brandId: string): Promise<BrandRow | undefined> {
  const rows = await tx.select().from(brands).where(eq(brands.id, brandId)).limit(1);
  return rows[0];
}

/**
 * Resolve an active prompt template body by id, or by (agent_type) as a
 * fallback lookup for the tenant. Returns undefined when none is configured —
 * callers then use the file-based default in `agents/prompts`.
 */
export async function getPromptTemplateBody(
  tx: TenantTx,
  opts: { id?: string; agentType?: string },
): Promise<string | undefined> {
  if (opts.id) {
    const rows = await tx
      .select({ body: promptTemplates.body })
      .from(promptTemplates)
      .where(and(eq(promptTemplates.id, opts.id), eq(promptTemplates.isActive, true)))
      .limit(1);
    if (rows[0]?.body) return rows[0].body;
  }
  if (opts.agentType) {
    const rows = await tx
      .select({ body: promptTemplates.body })
      .from(promptTemplates)
      .where(and(eq(promptTemplates.agentType, opts.agentType), eq(promptTemplates.isActive, true)))
      .limit(1);
    if (rows[0]?.body) return rows[0].body;
  }
  return undefined;
}

/** Compact one-line brand context string used to condition LLM prompts. */
export function brandContextLine(brand: BrandRow | undefined): string {
  if (!brand) return '';
  const parts: string[] = [];
  if (brand.companyName) parts.push(`Company: ${brand.companyName}`);
  if (brand.industry) parts.push(`Industry: ${brand.industry}`);
  if (brand.brandVoice) parts.push(`Voice: ${brand.brandVoice}`);
  if (brand.writingStyle) parts.push(`Style: ${brand.writingStyle}`);
  if (brand.preferredCta) parts.push(`Preferred CTA: ${brand.preferredCta}`);
  if (brand.mission) parts.push(`Mission: ${brand.mission}`);
  return parts.join(' | ');
}

/** Brand-prefix used for LLM prompt caching (per-brand). */
export function brandPrefix(brand: BrandRow | undefined, orgId: string): string {
  return brand ? `brand:${brand.id}` : `org:${orgId}`;
}
