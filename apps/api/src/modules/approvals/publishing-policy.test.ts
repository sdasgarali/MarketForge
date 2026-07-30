import { describe, expect, it } from 'vitest';
import type { TrustTier } from '@marketforge/contracts';
import {
  decidePublishing,
  type ApprovalPolicyInput,
  type PublishingPolicyInput,
} from './publishing-policy.js';

function input(
  overrides: Partial<PublishingPolicyInput> & { approval?: Partial<ApprovalPolicyInput> } = {},
): PublishingPolicyInput {
  const { approval, ...rest } = overrides;
  return {
    trustTier: 'new',
    compositeScore: 95,
    threshold: 90,
    approvalSettings: { mode: 'manual', min_score: 90, trust_tier: 'new', ...approval },
    ...rest,
  };
}

describe('decidePublishing', () => {
  it('blocks when score is below the threshold', () => {
    const d = decidePublishing(input({ compositeScore: 80 }));
    expect(d.decision).toBe('block');
    expect(d.autoPublish).toBe(false);
  });

  it('blocks when score is NaN / non-finite', () => {
    const d = decidePublishing(input({ compositeScore: Number.NaN }));
    expect(d.decision).toBe('block');
  });

  it('uses the stricter of threshold and brand min_score', () => {
    // threshold 90 but brand demands 98 → 95 is below the effective bar.
    const d = decidePublishing(
      input({ compositeScore: 95, threshold: 90, approval: { min_score: 98 } }),
    );
    expect(d.decision).toBe('block');
  });

  it('auto-schedules for auto tier + auto mode when score passes', () => {
    const d = decidePublishing(
      input({ trustTier: 'auto', approval: { mode: 'auto', trust_tier: 'auto' } }),
    );
    expect(d.decision).toBe('auto-schedule');
    expect(d.autoPublish).toBe(true);
  });

  it('requires approval for auto mode but non-auto tier', () => {
    const tiers: TrustTier[] = ['new', 'reviewed', 'trusted'];
    for (const tier of tiers) {
      const d = decidePublishing(input({ trustTier: tier, approval: { mode: 'auto' } }));
      expect(d.decision, `tier=${tier}`).toBe('require-approval');
      expect(d.autoPublish).toBe(false);
    }
  });

  it('requires approval when mode is manual even for auto tier', () => {
    const d = decidePublishing(
      input({ trustTier: 'auto', approval: { mode: 'manual', trust_tier: 'auto' } }),
    );
    expect(d.decision).toBe('require-approval');
  });

  it('passes exactly at the threshold boundary', () => {
    const d = decidePublishing(
      input({
        compositeScore: 90,
        threshold: 90,
        trustTier: 'auto',
        approval: { mode: 'auto', min_score: 90, trust_tier: 'auto' },
      }),
    );
    expect(d.decision).toBe('auto-schedule');
  });
});
