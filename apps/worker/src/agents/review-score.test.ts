import { describe, expect, it } from 'vitest';
import { computeComposite, STAGE_WEIGHTS, type StageScore } from './review-score.js';

const CID = '11111111-1111-1111-1111-111111111111';

describe('computeComposite', () => {
  it('passes when all stages meet the threshold', () => {
    const stages: StageScore[] = [
      { stage: 'grammar', score: 95, passed: true },
      { stage: 'brand', score: 92, passed: true },
      { stage: 'policy', score: 98, passed: true },
    ];
    const r = computeComposite(CID, stages, { threshold: 90 });
    expect(r.passed).toBe(true);
    expect(r.composite_score).toBeGreaterThanOrEqual(90);
    expect(r.failed_stages).toEqual([]);
    expect(r.content_item_id).toBe(CID);
  });

  it('fails and lists failed stages when a stage is below threshold', () => {
    const stages: StageScore[] = [
      { stage: 'grammar', score: 95, passed: true },
      { stage: 'brand', score: 70, passed: false },
      { stage: 'seo', score: 88, passed: false },
    ];
    const r = computeComposite(CID, stages, { threshold: 90 });
    expect(r.passed).toBe(false);
    expect(r.failed_stages).toContain('brand');
    expect(r.failed_stages).toContain('seo');
  });

  it('applies stage weights (policy is weighted heaviest)', () => {
    expect(STAGE_WEIGHTS.policy).toBeGreaterThan(STAGE_WEIGHTS.seo ?? 1);
    // A high-weight low stage drags the composite down more than a low-weight one.
    const heavyLow = computeComposite(CID, [
      { stage: 'policy', score: 40, passed: false },
      { stage: 'seo', score: 100, passed: true },
    ]);
    const lightLow = computeComposite(CID, [
      { stage: 'policy', score: 100, passed: true },
      { stage: 'seo', score: 40, passed: false },
    ]);
    expect(heavyLow.composite_score).toBeLessThan(lightLow.composite_score);
  });

  it('hard-vetoes on a failed policy stage even if the average is high', () => {
    const r = computeComposite(CID, [
      { stage: 'policy', score: 50, passed: false },
      { stage: 'grammar', score: 100, passed: true },
      { stage: 'brand', score: 100, passed: true },
      { stage: 'seo', score: 100, passed: true },
      { stage: 'marketing', score: 100, passed: true },
    ], { threshold: 90 });
    expect(r.passed).toBe(false);
    expect(r.composite_score).toBeLessThan(90);
  });

  it('hard-vetoes on a failed copyright stage', () => {
    const r = computeComposite(CID, [
      { stage: 'copyright', score: 20, passed: false },
      { stage: 'grammar', score: 100, passed: true },
    ]);
    expect(r.passed).toBe(false);
  });

  it('clamps out-of-range scores and treats empty input as not passed', () => {
    const clamped = computeComposite(CID, [{ stage: 'grammar', score: 150, passed: true }], { threshold: 90 });
    expect(clamped.stage_scores.grammar).toBe(100);

    const empty = computeComposite(CID, [], { threshold: 90 });
    expect(empty.passed).toBe(false);
    expect(empty.composite_score).toBe(0);
  });

  it('respects a custom threshold', () => {
    const stages: StageScore[] = [
      { stage: 'grammar', score: 82, passed: true },
      { stage: 'brand', score: 84, passed: true },
    ];
    expect(computeComposite(CID, stages, { threshold: 80 }).passed).toBe(true);
    expect(computeComposite(CID, stages, { threshold: 90 }).passed).toBe(false);
  });
});
