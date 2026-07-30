/**
 * Review aggregation helpers. Turns raw `review_results` rows into the web's
 * consumer shapes: an array of ReviewResult DTOs plus a CompositeReview verdict
 * (per-stage scores, composite score, pass/fail, failed stages). Used by the
 * approvals queue and the content-item detail endpoint.
 */
import type { ReviewResultRow } from '@marketforge/db';
import type { ReviewStage } from '@marketforge/contracts';
import { reviewResultToDto } from './mappers.js';

export interface CompositeReviewDto {
  content_item_id: string;
  stage_scores: Partial<Record<ReviewStage, number>>;
  composite_score: number;
  passed: boolean;
  threshold: number;
  failed_stages: ReviewStage[];
}

/**
 * Build a CompositeReview from a content item's review-result rows.
 *
 * @param contentItemId the item the reviews belong to.
 * @param rows          raw review_results rows (any stages present).
 * @param opts.threshold gate threshold (default 90).
 * @param opts.fallbackScore stored quality_score to use when there are no
 *   review rows yet (keeps the composite non-null so the UI renders).
 */
export function buildComposite(
  contentItemId: string,
  rows: ReviewResultRow[],
  opts: { threshold?: number; fallbackScore?: number | null } = {},
): CompositeReviewDto {
  const threshold = opts.threshold ?? 90;
  const stage_scores: Partial<Record<ReviewStage, number>> = {};
  const failed_stages: ReviewStage[] = [];

  for (const r of rows) {
    if (!r.stage) continue;
    const stage = r.stage as ReviewStage;
    const score = r.score == null ? 0 : Number(r.score);
    stage_scores[stage] = Number.isFinite(score) ? score : 0;
    // passed can be null in the DB; treat null as "meets threshold if score does".
    const passed = r.passed ?? score >= threshold;
    if (!passed) failed_stages.push(stage);
  }

  const values = Object.values(stage_scores) as number[];
  let composite_score: number;
  if (values.length > 0) {
    composite_score = Math.round(values.reduce((a, b) => a + b, 0) / values.length);
  } else if (opts.fallbackScore != null && Number.isFinite(opts.fallbackScore)) {
    composite_score = Math.round(Number(opts.fallbackScore));
  } else {
    composite_score = 0;
  }

  return {
    content_item_id: contentItemId,
    stage_scores,
    composite_score,
    passed: composite_score >= threshold && failed_stages.length === 0,
    threshold,
    failed_stages,
  };
}

/** Map raw review rows to the web's ReviewResult DTO array. */
export function reviewRowsToDtos(rows: ReviewResultRow[]) {
  return rows.map(reviewResultToDto);
}
