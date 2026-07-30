/**
 * research processor — Stage 1 of the pipeline. Runs the research agent, stores
 * a `research_reports` row, then enqueues `generate-text` for each MVP platform
 * requested (or the single platform on the payload).
 *
 * NEXT STAGE: generate-text.
 */
import { enqueueGenerateText } from '@marketforge/queue';
import { db, withTenant, researchReports } from '@marketforge/db';
import { MVP_PLATFORMS, type Platform } from '@marketforge/contracts';
import { defineProcessor } from './base.js';
import { TerminalError } from '../lib/errors.js';
import { getBrand, brandContextLine, getPromptTemplateBody } from '../lib/brand.js';
import { runResearchAgent } from '../agents/research.agent.js';

export const researchProcessor = defineProcessor('research', async ({ payload, log }) => {
  const { org_id, brand_id, campaign_id } = payload;
  if (!brand_id) throw new TerminalError('research job requires brand_id');
  const topic = payload.topic?.trim();
  if (!topic) throw new TerminalError('research job requires a topic');

  const report = await withTenant(db, org_id, async (tx) => {
    const brand = await getBrand(tx, brand_id);
    if (!brand) throw new TerminalError(`brand not found: ${brand_id}`);
    const promptOverride = await getPromptTemplateBody(tx, { agentType: 'research' });

    const result = await runResearchAgent(
      log,
      { workflow: 'research', agent: 'research', org_id, brand_id, campaign_id },
      {
        topic,
        platform: payload.platform,
        brandContext: brandContextLine(brand),
        sources: payload.sources,
        promptOverride,
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
        createdByAgent: 'research',
      })
      .returning({ id: researchReports.id });

    return { id: inserted[0]?.id as string, keywords: result.keywords };
  });

  // Fan out generate-text for each target platform (MVP: x + instagram, or the
  // single platform supplied on the research payload).
  const platforms: Platform[] = payload.platform ? [payload.platform] : [...MVP_PLATFORMS];
  for (const platform of platforms) {
    await enqueueGenerateText({
      org_id,
      brand_id,
      campaign_id,
      platform,
      content_type: 'post',
      research_report_id: report.id,
      language: 'en',
      attempt_reason: 'initial',
    });
  }

  log.info({ research_report_id: report.id, platforms }, 'research complete; enqueued generate-text');
  return { research_report_id: report.id };
});
