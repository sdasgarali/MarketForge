/**
 * Copywriter agent — produces platform-specific copy (title/body/caption/
 * hashtags) conditioned on brand voice + research. Routing hint task='copywriting'
 * (router → Sonnet-tier, ADR-007).
 */
import { adapters } from '@marketforge/adapters';
import type { Logger } from '@marketforge/logger';
import { runAi, type AiRunContext } from '../lib/ai-runner.js';
import { extractJson, parseHashtags } from '../lib/json.js';
import { COPYWRITER_SYSTEM, copywriterPrompt } from './prompts/index.js';

export interface CopywriterInput {
  platform: string;
  contentType: string;
  language: string;
  brandContext: string;
  brandPrefix?: string;
  researchSummary?: string;
  keywords?: string[];
  negativePrompt?: string;
  promptOverride?: string;
}

export interface CopywriterOutput {
  title: string;
  body: string;
  caption: string;
  hashtags: string[];
}

export async function runCopywriterAgent(
  log: Logger,
  ctx: AiRunContext,
  input: CopywriterInput,
): Promise<CopywriterOutput> {
  const prompt = input.promptOverride
    ? `${input.promptOverride}\n\nPlatform: ${input.platform}\nBrand: ${input.brandContext}\nResearch: ${input.researchSummary ?? ''}`
    : copywriterPrompt({
        platform: input.platform,
        contentType: input.contentType,
        language: input.language,
        brandContext: input.brandContext,
        researchSummary: input.researchSummary,
        keywords: input.keywords,
        negativePrompt: input.negativePrompt,
      });

  const text = await runAi(log, { ...ctx, agent: 'copywriter' }, async () => {
    const res = await adapters.llm.generateText({
      prompt,
      system: COPYWRITER_SYSTEM,
      task: 'copywriting',
      brandPrefix: input.brandPrefix,
    });
    return { result: res.text, usage: res.usage };
  });

  const parsed = extractJson<Partial<CopywriterOutput>>(text);
  const body = typeof parsed?.body === 'string' ? parsed.body : text.trim();
  return {
    title: typeof parsed?.title === 'string' ? parsed.title : '',
    body,
    caption: typeof parsed?.caption === 'string' ? parsed.caption : body.slice(0, 280),
    hashtags: parseHashtags(parsed?.hashtags as string[] | undefined),
  };
}
