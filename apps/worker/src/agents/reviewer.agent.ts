/**
 * Reviewer agent — runs one LLM scoring call per review stage and aggregates
 * into a CompositeReview via the pure `computeComposite`. Routing hint
 * task='review' (router → Opus-tier, ADR-007). Each stage call is logged.
 */
import { adapters } from '@marketforge/adapters';
import type { Logger } from '@marketforge/logger';
import type { CompositeReview, ReviewStage } from '@marketforge/contracts';
import { runAi, type AiRunContext } from '../lib/ai-runner.js';
import { extractJson } from '../lib/json.js';
import { REVIEWER_SYSTEM, reviewerPrompt } from './prompts/index.js';
import { computeComposite, type StageScore } from './review-score.js';

/** Default stage set for MVP text review (visual/accessibility are image-only). */
export const DEFAULT_REVIEW_STAGES: readonly ReviewStage[] = [
  'grammar',
  'brand',
  'policy',
  'duplicate',
  'seo',
  'marketing',
];

export interface ReviewContentInput {
  stages: readonly ReviewStage[];
  threshold: number;
  brandContext: string;
  content: { title?: string; body?: string; caption?: string; hashtags?: string[] };
}

export interface StageReviewDetail extends StageScore {
  findings: unknown;
  model: string;
  tokens: number;
  costUsd: number;
}

export interface ReviewAgentResult {
  composite: CompositeReview;
  details: StageReviewDetail[];
}

async function reviewOneStage(
  log: Logger,
  ctx: AiRunContext,
  stage: ReviewStage,
  input: ReviewContentInput,
): Promise<StageReviewDetail> {
  const prompt = reviewerPrompt({
    stage,
    brandContext: input.brandContext,
    title: input.content.title,
    body: input.content.body,
    caption: input.content.caption,
    hashtags: input.content.hashtags,
  });

  let model = 'unknown';
  let tokens = 0;
  let costUsd = 0;

  const text = await runAi(log, { ...ctx, agent: `reviewer:${stage}` }, async () => {
    const res = await adapters.llm.generateText({ prompt, system: REVIEWER_SYSTEM, task: 'review' });
    model = res.usage.model;
    tokens = (res.usage.tokens_in ?? 0) + (res.usage.tokens_out ?? 0);
    costUsd = res.usage.cost_usd ?? 0;
    return { result: res.text, usage: res.usage };
  });

  const parsed = extractJson<{ score?: number; passed?: boolean; findings?: unknown }>(text);
  const score = typeof parsed?.score === 'number' ? parsed.score : 0;
  const passed = typeof parsed?.passed === 'boolean' ? parsed.passed : score >= input.threshold;

  return { stage, score, passed, findings: parsed?.findings ?? text.slice(0, 500), model, tokens, costUsd };
}

/**
 * Run all stages (sequentially to bound cost/rate) and compute the composite.
 */
export async function runReviewerAgent(
  log: Logger,
  ctx: AiRunContext,
  input: ReviewContentInput,
): Promise<ReviewAgentResult> {
  const details: StageReviewDetail[] = [];
  for (const stage of input.stages) {
    details.push(await reviewOneStage(log, ctx, stage, input));
  }
  const composite = computeComposite(
    ctx.content_item_id ?? '',
    details.map((d) => ({ stage: d.stage, score: d.score, passed: d.passed })),
    { threshold: input.threshold },
  );
  return { composite, details };
}
