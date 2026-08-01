/**
 * research processor — Stage 1 of the pipeline. Runs the Market Research Manager
 * (tenant + competitor + strategy sub-agents → decision), stores a
 * `research_reports` row, then enqueues `generate-text` for the Manager's
 * recommended platforms (falling back to the payload platform / MVP defaults),
 * with the recommended format per platform.
 *
 * NEXT STAGE: generate-text.
 */
import { enqueueGenerateText } from '@marketforge/queue';
import { db, withTenant, researchReports } from '@marketforge/db';
import { MVP_PLATFORMS, type ContentType, type Platform } from '@marketforge/contracts';
import { defineProcessor } from './base.js';
import { TerminalError } from '../lib/errors.js';
import { getBrand, brandContextLine } from '../lib/brand.js';
import { runMarketResearchManager, type FormatRec } from '../agents/market-research.agent.js';

/** Platforms we may act on (the MVP publish set + calendar platforms). */
const KNOWN_PLATFORMS = new Set<Platform>(['x', 'instagram', 'facebook', 'linkedin', 'youtube', 'tiktok']);

/** Map a Manager format string onto our ContentType enum (best-effort). */
function toContentType(format: string | undefined): ContentType {
  const f = (format ?? '').toLowerCase();
  const allowed: ContentType[] = ['post', 'reel', 'short', 'thread', 'carousel', 'article', 'story', 'video'];
  if (allowed.includes(f as ContentType)) return f as ContentType;
  if (f.includes('poster') || f.includes('image')) return 'post';
  if (f.includes('blog') || f.includes('case')) return 'article';
  if (f.includes('video')) return 'video';
  return 'post';
}

export const researchProcessor = defineProcessor('research', async ({ payload, log }) => {
  const { org_id, brand_id, campaign_id } = payload;
  if (!brand_id) throw new TerminalError('research job requires brand_id');
  const topic = payload.topic?.trim();
  if (!topic) throw new TerminalError('research job requires a topic');

  const report = await withTenant(db, org_id, async (tx) => {
    const brand = await getBrand(tx, brand_id);
    if (!brand) throw new TerminalError(`brand not found: ${brand_id}`);

    // Market Research Manager: runs tenant/competitor/strategy sub-agents, then
    // decides topics + platforms + formats (operator plan §7).
    const result = await runMarketResearchManager(
      log,
      { workflow: 'research', agent: 'market-research-manager', org_id, brand_id, campaign_id },
      {
        topic,
        platform: payload.platform,
        brandContext: brandContextLine(brand),
        competitors: (brand.competitors as string[] | null) ?? undefined,
      },
    );

    const inserted = await tx
      .insert(researchReports)
      .values({
        orgId: org_id,
        brandId: brand_id,
        campaignId: campaign_id ?? null,
        sources: (payload.sources ?? null) as unknown,
        summary: result.summary,
        keywords: result.keywords,
        hashtags: result.hashtags,
        hooks: result.hooks as unknown,
        painPoints: result.painPoints as unknown,
        searchIntent: result.searchIntent as unknown,
        raw: result.raw as unknown,
        createdByAgent: 'market-research-manager',
      })
      .returning({ id: researchReports.id });

    return {
      id: inserted[0]?.id as string,
      recommendedPlatforms: result.recommendedPlatforms,
      recommendedFormats: result.recommendedFormats,
    };
  });

  // Decide the fan-out. Priority: explicit payload platform → Manager's
  // recommended platforms → MVP defaults. Format comes from the Manager.
  const formatByPlatform = new Map<string, string>(
    report.recommendedFormats.map((f: FormatRec) => [f.platform, f.format]),
  );
  let platforms: Platform[];
  if (payload.platform) {
    platforms = [payload.platform];
  } else {
    const recommended = report.recommendedPlatforms.filter((p): p is Platform =>
      KNOWN_PLATFORMS.has(p as Platform),
    );
    platforms = recommended.length ? recommended : [...MVP_PLATFORMS];
  }

  for (const platform of platforms) {
    await enqueueGenerateText({
      org_id,
      brand_id,
      campaign_id,
      platform,
      content_type: toContentType(formatByPlatform.get(platform)),
      research_report_id: report.id,
      language: 'en',
      attempt_reason: 'initial',
    });
  }

  log.info(
    { research_report_id: report.id, platforms, formats: [...formatByPlatform.entries()] },
    'research complete; enqueued generate-text',
  );
  return { research_report_id: report.id };
});
