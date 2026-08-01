/**
 * Market Research Manager (operator plan §7). Runs three sub-agents in parallel —
 * tenant analysis, competitor analysis, business strategy — then a Manager
 * synthesis that DECIDES the content plan (topics, platforms, formats). Every LLM
 * call flows through `runAi` (mandatory logAiRun) with a distinct agent name for
 * cost attribution. Output is a superset of the classic ResearchOutput so the
 * research processor stays compatible.
 */
import { adapters } from '@marketforge/adapters';
import type { Logger } from '@marketforge/logger';
import { runAi, type AiRunContext } from '../lib/ai-runner.js';
import { extractJson, parseHashtags } from '../lib/json.js';
import {
  BUSINESS_STRATEGY_SYSTEM,
  COMPETITOR_ANALYSIS_SYSTEM,
  RESEARCH_MANAGER_SYSTEM,
  TENANT_ANALYSIS_SYSTEM,
  businessStrategyPrompt,
  competitorAnalysisPrompt,
  researchManagerPrompt,
  tenantAnalysisPrompt,
} from './prompts/index.js';

export interface MarketResearchInput {
  topic: string;
  platform?: string;
  brandContext: string;
  competitors?: string[];
}

export interface FormatRec {
  platform: string;
  format: string;
}

export interface MarketResearchOutput {
  summary: string;
  keywords: string[];
  hashtags: string[];
  hooks: string[];
  painPoints: string[];
  searchIntent: string[];
  topics: string[];
  recommendedPlatforms: string[];
  recommendedFormats: FormatRec[];
  raw: unknown;
}

const asArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

/** Run one sub-agent and return its raw text (JSON string) for the manager. */
async function subAgent(
  log: Logger,
  ctx: AiRunContext,
  agent: string,
  system: string,
  prompt: string,
): Promise<string> {
  return runAi(log, { ...ctx, agent }, async () => {
    const res = await adapters.llm.generateText({
      prompt,
      system,
      task: 'research',
      brandPrefix: ctx.brand_id ? `brand:${ctx.brand_id}` : undefined,
    });
    return { result: res.text, usage: res.usage };
  });
}

export async function runMarketResearchManager(
  log: Logger,
  ctx: AiRunContext,
  input: MarketResearchInput,
): Promise<MarketResearchOutput> {
  // 1) Sub-agents in parallel — they share the request's adapter bundle.
  const [tenant, competitor, strategy] = await Promise.all([
    subAgent(
      log,
      ctx,
      'market-researcher:tenant',
      TENANT_ANALYSIS_SYSTEM,
      tenantAnalysisPrompt({ brandContext: input.brandContext }),
    ),
    subAgent(
      log,
      ctx,
      'market-researcher:competitor',
      COMPETITOR_ANALYSIS_SYSTEM,
      competitorAnalysisPrompt({ brandContext: input.brandContext, competitors: input.competitors }),
    ),
    subAgent(
      log,
      ctx,
      'market-researcher:strategy',
      BUSINESS_STRATEGY_SYSTEM,
      businessStrategyPrompt({ brandContext: input.brandContext }),
    ),
  ]);

  // 2) Manager synthesis — decides topics/platforms/formats from the reports.
  const text = await runAi(log, { ...ctx, agent: 'market-research-manager' }, async () => {
    const res = await adapters.llm.generateText({
      prompt: researchManagerPrompt({
        topic: input.topic,
        platform: input.platform,
        brandContext: input.brandContext,
        tenant,
        competitor,
        strategy,
      }),
      system: RESEARCH_MANAGER_SYSTEM,
      task: 'research',
      brandPrefix: ctx.brand_id ? `brand:${ctx.brand_id}` : undefined,
    });
    return { result: res.text, usage: res.usage };
  });

  const parsed = extractJson<{
    summary?: string;
    keywords?: string[];
    hashtags?: string[];
    hooks?: string[];
    pain_points?: string[];
    search_intent?: string[];
    topics?: string[];
    recommended_platforms?: string[];
    recommended_formats?: FormatRec[];
  }>(text);

  return {
    summary: typeof parsed?.summary === 'string' ? parsed.summary : text.slice(0, 2000),
    keywords: asArr(parsed?.keywords),
    hashtags: parseHashtags(parsed?.hashtags),
    hooks: asArr(parsed?.hooks),
    painPoints: asArr(parsed?.pain_points),
    searchIntent: asArr(parsed?.search_intent),
    topics: asArr(parsed?.topics),
    recommendedPlatforms: asArr(parsed?.recommended_platforms).map((p) => p.toLowerCase()),
    recommendedFormats: Array.isArray(parsed?.recommended_formats)
      ? parsed!.recommended_formats
          .filter((f): f is FormatRec => !!f && typeof f.platform === 'string')
          .map((f) => ({ platform: String(f.platform).toLowerCase(), format: String(f.format ?? 'post') }))
      : [],
    raw: { manager: parsed ?? { text }, tenant, competitor, strategy },
  };
}
