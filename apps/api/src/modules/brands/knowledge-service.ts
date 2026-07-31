/**
 * Per-brand knowledge base (RAG). List / add / delete documents, plus an
 * AI-powered `refresh` that researches the brand with the org's own LLM and
 * stores fresh knowledge snippets. Tenant-scoped.
 */
import { and, desc, eq } from 'drizzle-orm';
import { brandKnowledge, brands, db, withTenant } from '@marketforge/db';
import { BadRequestError, NotFoundError } from '../../http/errors.js';
import { getOrgLlm, orgHasLlm } from '../../lib/org-llm.js';

function toDto(r: {
  id: string;
  brandId: string;
  title: string;
  content: string;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    id: r.id,
    brand_id: r.brandId,
    title: r.title,
    content: r.content,
    source: r.source,
    created_at: r.createdAt.toISOString(),
    updated_at: r.updatedAt.toISOString(),
  };
}

/** Best-effort extraction of a JSON array from an LLM response. */
function parseSnippets(text: string): Array<{ title: string; content: string }> {
  const start = text.indexOf('[');
  const end = text.lastIndexOf(']');
  if (start === -1 || end === -1) return [];
  try {
    const arr = JSON.parse(text.slice(start, end + 1)) as unknown;
    if (!Array.isArray(arr)) return [];
    return arr
      .filter((x): x is { title: string; content: string } =>
        Boolean(x && typeof x === 'object' && 'content' in x),
      )
      .map((x) => ({ title: String(x.title ?? 'Untitled').slice(0, 200), content: String(x.content) }));
  } catch {
    return [];
  }
}

export const brandKnowledgeService = {
  async list(orgId: string, brandId: string) {
    const rows = await withTenant(db, orgId, (tx) =>
      tx
        .select()
        .from(brandKnowledge)
        .where(eq(brandKnowledge.brandId, brandId))
        .orderBy(desc(brandKnowledge.createdAt)),
    );
    return rows.map(toDto);
  },

  async add(orgId: string, brandId: string, input: { title: string; content: string; source?: string }) {
    const [row] = await withTenant(db, orgId, (tx) =>
      tx
        .insert(brandKnowledge)
        .values({
          orgId,
          brandId,
          title: input.title,
          content: input.content,
          source: input.source ?? 'user',
        })
        .returning(),
    );
    return toDto(row!);
  },

  async remove(orgId: string, brandId: string, id: string) {
    const [row] = await withTenant(db, orgId, (tx) =>
      tx
        .delete(brandKnowledge)
        .where(and(eq(brandKnowledge.id, id), eq(brandKnowledge.brandId, brandId)))
        .returning({ id: brandKnowledge.id }),
    );
    if (!row) throw new NotFoundError('Knowledge entry not found');
    return { id: row.id };
  },

  /** AI refresh: research the brand with the org's LLM → store snippets. */
  async refresh(orgId: string, brandId: string) {
    const [brand] = await withTenant(db, orgId, (tx) =>
      tx
        .select({ name: brands.companyName, industry: brands.industry })
        .from(brands)
        .where(eq(brands.id, brandId))
        .limit(1),
    );
    if (!brand) throw new NotFoundError('Brand not found');

    if (!(await orgHasLlm(orgId))) {
      throw new BadRequestError(
        'No AI provider configured. Add a text-AI key (e.g. NVIDIA free, Anthropic, OpenAI) in Integrations first.',
      );
    }

    const llm = await getOrgLlm(orgId);
    const res = await llm.generateText({
      task: 'research',
      system:
        'You are a brand research assistant. Output ONLY a JSON array of 4-6 objects with keys "title" and "content". No prose, no markdown.',
      prompt: `Research the brand "${brand.name}"${brand.industry ? ` (industry: ${brand.industry})` : ''}. Produce concise, factual knowledge snippets covering: target audience, positioning & differentiators, popular/appropriate social content topics, and brand tone. Each "content" 1-3 sentences.`,
      brandPrefix: `brand:${brandId}`,
    });

    const snippets = parseSnippets(res.text);
    if (!snippets.length) {
      throw new BadRequestError(
        'The AI returned no usable snippets. Check that the configured provider/model works (test it in Integrations).',
      );
    }

    const rows = await withTenant(db, orgId, (tx) =>
      tx
        .insert(brandKnowledge)
        .values(
          snippets.map((s) => ({
            orgId,
            brandId,
            title: s.title,
            content: s.content,
            source: 'ai',
          })),
        )
        .returning(),
    );
    return { refreshed: rows.length, model: res.usage.model, items: rows.map(toDto) };
  },
};
