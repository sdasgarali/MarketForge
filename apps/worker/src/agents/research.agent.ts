/**
 * Research agent — synthesizes a structured research report from a topic + brand
 * context. Model routing hint: task='research' (router picks a reasoning-tier
 * model). Every call flows through `runAi` (mandatory logAiRun).
 */
import { adapters } from '@marketforge/adapters';
import type { Logger } from '@marketforge/logger';
import { runAi, type AiRunContext } from '../lib/ai-runner.js';
import { extractJson, parseHashtags } from '../lib/json.js';
import { RESEARCH_SYSTEM, researchPrompt } from './prompts/index.js';

export interface ResearchInput {
  topic: string;
  platform?: string;
  brandContext: string;
  sources?: string[];
  promptOverride?: string;
}

export interface ResearchOutput {
  summary: string;
  keywords: string[];
  hashtags: string[];
  hooks: string[];
  painPoints: string[];
  searchIntent: string[];
  raw: unknown;
}

export async function runResearchAgent(
  log: Logger,
  ctx: AiRunContext,
  input: ResearchInput,
): Promise<ResearchOutput> {
  const prompt = input.promptOverride
    ? `${input.promptOverride}\n\nTopic: ${input.topic}\nBrand: ${input.brandContext}`
    : researchPrompt({
        topic: input.topic,
        platform: input.platform,
        brandContext: input.brandContext,
        sources: input.sources,
      });

  const text = await runAi(log, { ...ctx, agent: 'research' }, async () => {
    const res = await adapters.llm.generateText({
      prompt,
      system: RESEARCH_SYSTEM,
      task: 'research',
      brandPrefix: ctx.brand_id ? `brand:${ctx.brand_id}` : undefined,
    });
    return { result: res.text, usage: res.usage };
  });

  const parsed = extractJson<Partial<ResearchOutput> & { pain_points?: string[]; search_intent?: string[] }>(text);
  const asArr = (v: unknown): string[] => (Array.isArray(v) ? v.map(String) : []);

  return {
    summary: typeof parsed?.summary === 'string' ? parsed.summary : text.slice(0, 2000),
    keywords: asArr(parsed?.keywords),
    hashtags: parseHashtags(parsed?.hashtags as string[] | undefined),
    hooks: asArr(parsed?.hooks),
    painPoints: asArr(parsed?.pain_points ?? (parsed as { painPoints?: string[] })?.painPoints),
    searchIntent: asArr(parsed?.search_intent ?? (parsed as { searchIntent?: string[] })?.searchIntent),
    raw: parsed ?? { text },
  };
}
