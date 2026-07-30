/**
 * Worker-wide tunables. All are overridable via env where it makes sense; the
 * defaults here encode the MVP policy (CLAUDE.md + ADRs).
 */

/** Logical service name attached to every worker log line. */
export const SERVICE = 'worker' as const;

/** AI review composite threshold below which regeneration is triggered. */
export const DEFAULT_REVIEW_THRESHOLD = 90;

/**
 * Max automatic regeneration attempts for a content item before we stop the
 * regen loop and route to human approval regardless of score (CLAUDE.md: auto
 * regen if < threshold, then human gate). Guards against infinite loops.
 */
export const MAX_REGEN_ATTEMPTS = 2;

/** Delay before the first analytics pull after a successful publish (~1h). */
export const ANALYTICS_INITIAL_DELAY_MS = 60 * 60 * 1000;

/** Delay between follow-up analytics pulls (~24h). */
export const ANALYTICS_FOLLOWUP_DELAY_MS = 24 * 60 * 60 * 1000;

/** Max number of analytics pulls per publish (initial + follow-ups). */
export const ANALYTICS_MAX_PULLS = 3;

/** n8n publish sub-workflow path (ADR-005 modular sub-workflows). */
export const N8N_PUBLISH_PATH = '/webhook/wf-publish';

/** n8n analytics collection sub-workflow path. */
export const N8N_ANALYTICS_PATH = '/webhook/wf-collect-analytics';
