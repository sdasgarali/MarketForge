/**
 * publishingPolicy — the trust-tier + AI-score gate that decides what happens
 * when a content item is approved (CLAUDE.md "per-brand trust tiers" + hard
 * constraint "never publish immediately without passing review").
 *
 * Pure + dependency-free so it is exhaustively unit-testable. The approvals
 * service wires the decision to the backend-owned Scheduler (ADR-004).
 *
 * Decision matrix (inputs → decision):
 *  - block            : composite score < threshold (min_score). Never publishes;
 *                       needs regeneration/human fix regardless of tier.
 *  - auto-schedule    : score ≥ threshold AND brand is eligible for auto-publish
 *                       (approval mode 'auto' AND trust tier 'auto'). The trusted
 *                       brand "graduates" past the human gate.
 *  - require-approval : score ≥ threshold but the brand still requires a human
 *                       (new/reviewed/trusted tier, or manual approval mode).
 *
 * Note: even the `require-approval` path is reached only via a human clicking
 * "approve"; the distinction is whether the *publish* is then auto-scheduled or
 * held for an explicit scheduled time / further human action.
 */
import type { TrustTier } from '@marketforge/contracts';

export type PublishDecision = 'auto-schedule' | 'require-approval' | 'block';

/** Brand approval configuration (mirrors contracts `ApprovalSettings`). */
export interface ApprovalPolicyInput {
  /** 'auto' allows graduation to auto-publish; 'manual' always requires a human. */
  mode: 'auto' | 'manual';
  /** Minimum composite score to pass the gate (0–100). */
  min_score: number;
  /** Per-brand trust tier. Only 'auto' is eligible for hands-off publishing. */
  trust_tier: TrustTier;
}

export interface PublishingPolicyInput {
  /** Brand trust tier (authoritative; may differ from approval_settings copy). */
  trustTier: TrustTier;
  /** AI composite review score for the content item (0–100). */
  compositeScore: number;
  /** Threshold to compare the score against (default 90 upstream). */
  threshold: number;
  /** Brand approval settings. */
  approvalSettings: ApprovalPolicyInput;
}

export interface PublishingPolicyDecision {
  decision: PublishDecision;
  /** Human-readable rationale (audit + UI). */
  reason: string;
  /** True only for 'auto-schedule' — convenience for callers. */
  autoPublish: boolean;
}

/** Tiers permitted to publish without a human, when everything else passes. */
const AUTO_ELIGIBLE_TIERS: ReadonlySet<TrustTier> = new Set<TrustTier>(['auto']);

/**
 * Decide the publishing outcome for an approved item. Score gate first (hard
 * constraint), then trust-tier graduation.
 */
export function decidePublishing(input: PublishingPolicyInput): PublishingPolicyDecision {
  const { trustTier, compositeScore, threshold, approvalSettings } = input;

  // Effective threshold: the stricter of the passed threshold and the brand's
  // configured minimum score. Never publish below either bar.
  const effectiveThreshold = Math.max(threshold, approvalSettings.min_score);

  if (!Number.isFinite(compositeScore) || compositeScore < effectiveThreshold) {
    return {
      decision: 'block',
      autoPublish: false,
      reason: `composite score ${compositeScore} below threshold ${effectiveThreshold}`,
    };
  }

  const autoEligible = approvalSettings.mode === 'auto' && AUTO_ELIGIBLE_TIERS.has(trustTier);

  if (autoEligible) {
    return {
      decision: 'auto-schedule',
      autoPublish: true,
      reason: `trust tier '${trustTier}' with auto mode and score ${compositeScore} ≥ ${effectiveThreshold}`,
    };
  }

  return {
    decision: 'require-approval',
    autoPublish: false,
    reason:
      approvalSettings.mode === 'manual'
        ? 'brand approval mode is manual'
        : `trust tier '${trustTier}' not yet graduated to auto-publish`,
  };
}
