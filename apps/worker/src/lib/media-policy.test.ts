import { describe, expect, it } from 'vitest';
import { resolveMediaPlan, type MediaPolicyConfig } from './media-policy.js';

const CFG: MediaPolicyConfig = {
  enabled: true,
  allowLongform: false,
  shortMaxS: 15,
  gifMaxS: 6,
  defaultModel: 'kling',
};

describe('resolveMediaPlan', () => {
  it('routes a normal short request to "short" with kling default + mp4', () => {
    const plan = resolveMediaPlan({ durationS: 10 }, CFG);
    expect(plan.action).toBe('short');
    expect(plan.model).toBe('kling');
    expect(plan.outputFormat).toBe('mp4');
    expect(plan.durationS).toBe(10);
  });

  it('honours a model hint on a short request', () => {
    const plan = resolveMediaPlan({ durationS: 8, modelHint: 'veo' }, CFG);
    expect(plan.action).toBe('short');
    expect(plan.model).toBe('veo');
  });

  it('honours withAudio on a short request', () => {
    const plan = resolveMediaPlan({ durationS: 8, withAudio: true }, CFG);
    expect(plan.withAudio).toBe(true);
  });

  it('clamps an over-cap short request down to the short cap (when not big)', () => {
    // duration exactly at cap stays; > cap becomes "big" → paused (tested below).
    const plan = resolveMediaPlan({ durationS: 15 }, CFG);
    expect(plan.action).toBe('short');
    expect(plan.durationS).toBe(15);
  });

  it('defaults an unspecified short duration to the short cap', () => {
    const plan = resolveMediaPlan({}, CFG);
    expect(plan.action).toBe('short');
    expect(plan.durationS).toBe(CFG.shortMaxS);
  });

  it('routes output_format=gif to "gif": silent, clamped to gif cap, .gif', () => {
    const plan = resolveMediaPlan({ outputFormat: 'gif', durationS: 4, withAudio: true }, CFG);
    expect(plan.action).toBe('gif');
    expect(plan.outputFormat).toBe('gif');
    expect(plan.withAudio).toBe(false); // always silent
    expect(plan.durationS).toBe(4);
  });

  it('clamps an over-cap gif duration down to GIF_MAX_S', () => {
    const plan = resolveMediaPlan({ outputFormat: 'gif', durationS: 30 }, CFG);
    expect(plan.action).toBe('gif');
    expect(plan.durationS).toBe(CFG.gifMaxS);
  });

  it('does NOT pause an over-cap gif (gif is inherently short)', () => {
    const plan = resolveMediaPlan({ outputFormat: 'gif', durationS: 100 }, CFG);
    expect(plan.action).toBe('gif');
  });

  it('pauses an over-cap (big) non-gif request when long-form is not allowed', () => {
    const plan = resolveMediaPlan({ durationS: 30 }, CFG);
    expect(plan.action).toBe('paused');
    expect(plan.durationS).toBe(0);
    expect(plan.reason).toMatch(/exceeds short cap/);
  });

  it('pauses an explicit longform request even under the cap', () => {
    const plan = resolveMediaPlan({ durationS: 5, longform: true }, CFG);
    expect(plan.action).toBe('paused');
    expect(plan.reason).toMatch(/long-form/i);
  });

  it('pauses everything when video is disabled', () => {
    const plan = resolveMediaPlan({ durationS: 5 }, { ...CFG, enabled: false });
    expect(plan.action).toBe('paused');
    expect(plan.reason).toMatch(/disabled/);
  });

  it('allows long-form (no pause, honours full duration) when the switch is on', () => {
    const plan = resolveMediaPlan(
      { durationS: 45, longform: true },
      { ...CFG, allowLongform: true },
    );
    expect(plan.action).toBe('short');
    expect(plan.durationS).toBe(45); // not clamped when explicitly allowed
    expect(plan.model).toBe('kling');
  });

  it('allows an over-cap non-longform duration when the switch is on', () => {
    const plan = resolveMediaPlan({ durationS: 20 }, { ...CFG, allowLongform: true });
    expect(plan.action).toBe('short');
    expect(plan.durationS).toBe(20);
  });
});
