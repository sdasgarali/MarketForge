/**
 * Pure composite-review scoring. No IO — deterministic given per-stage scores.
 * This is the gate that decides approval vs regeneration (threshold default 90).
 * Unit-tested in review-score.test.ts.
 */
import type { CompositeReview, ReviewStage } from '@marketforge/contracts';

/** A single stage's score result (as produced by the reviewer agent). */
export interface StageScore {
  stage: ReviewStage;
  score: number;
  passed: boolean;
}

/**
 * Per-stage weights for the composite. Safety/brand stages dominate; discovery
 * stages contribute less. Unlisted stages default to weight 1. A failing safety
 * stage (policy) is treated as a hard veto regardless of the weighted average.
 */
export const STAGE_WEIGHTS: Partial<Record<ReviewStage, number>> = {
  policy: 3,
  brand: 2,
  grammar: 2,
  fact: 2,
  copyright: 2,
  duplicate: 1.5,
  seo: 1,
  marketing: 1,
  visual: 1,
  accessibility: 1,
};

/** Stages whose failure hard-vetoes the whole item (score forced below threshold). */
export const VETO_STAGES: readonly ReviewStage[] = ['policy', 'copyright'];

export interface ComputeCompositeOptions {
  threshold?: number;
}

/**
 * Compute the weighted composite score + pass/fail verdict from per-stage
 * scores. Clamps inputs to [0,100]; empty input yields score 0 / not passed.
 */
export function computeComposite(
  contentItemId: string,
  stages: StageScore[],
  opts: ComputeCompositeOptions = {},
): CompositeReview {
  const threshold = opts.threshold ?? 90;
  const clamp = (n: number): number => Math.max(0, Math.min(100, Number.isFinite(n) ? n : 0));

  const stageScores: Partial<Record<ReviewStage, number>> = {};
  const failedStages: ReviewStage[] = [];

  let weightedSum = 0;
  let weightTotal = 0;
  let vetoed = false;

  for (const s of stages) {
    const score = clamp(s.score);
    stageScores[s.stage] = score;
    const weight = STAGE_WEIGHTS[s.stage] ?? 1;
    weightedSum += score * weight;
    weightTotal += weight;

    const stagePassed = s.passed && score >= threshold;
    if (!stagePassed) failedStages.push(s.stage);
    if (VETO_STAGES.includes(s.stage) && (!s.passed || score < threshold)) {
      vetoed = true;
    }
  }

  const rawComposite = weightTotal > 0 ? weightedSum / weightTotal : 0;
  // A veto forces the composite just below the threshold so the item cannot be
  // auto-approved even if the weighted average is otherwise high.
  const composite = vetoed ? Math.min(rawComposite, threshold - 1) : rawComposite;
  const compositeRounded = Math.round(composite * 100) / 100;
  const passed = !vetoed && compositeRounded >= threshold && stages.length > 0;

  return {
    content_item_id: contentItemId,
    stage_scores: stageScores as Record<ReviewStage, number>,
    composite_score: compositeRounded,
    passed,
    threshold,
    failed_stages: failedStages,
  };
}
