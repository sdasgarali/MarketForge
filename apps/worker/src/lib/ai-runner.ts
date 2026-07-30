/**
 * AI-run wrapper — the single choke point through which every LLM/image/video
 * call in the worker flows. It enforces the platform's HARD RULE: *every* AI
 * call is logged with model, tokens, cost, latency, and retries (CLAUDE.md +
 * ADR-009) via `logAiRun`. It also provides uniform retry with the router's
 * fallback semantics (the adapter itself owns provider fallback; here we retry
 * transient failures a bounded number of times).
 */
import { logAiRun, type Logger } from '@marketforge/logger';
import type { Usage } from '@marketforge/contracts';
import { toError } from './errors.js';

/** Correlation context every AI run is tagged with (for cost attribution). */
export interface AiRunContext {
  workflow: string;
  agent: string;
  org_id: string;
  brand_id?: string;
  campaign_id?: string;
  content_item_id?: string;
  output_version?: number;
}

/** A callable that returns some result plus the adapter Usage it consumed. */
export type AiCall<T> = () => Promise<{ result: T; usage: Usage }>;

export interface RunAiOptions {
  /** Max attempts (>=1). Default 3. */
  maxAttempts?: number;
  /** Base delay for backoff between retries (ms). Default 500. */
  baseDelayMs?: number;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Execute an AI adapter call with bounded retries, logging EVERY terminal
 * outcome (and the final failure) via `logAiRun`. Returns the successful
 * result; rethrows the last error after exhausting attempts.
 */
export async function runAi<T>(
  log: Logger,
  ctx: AiRunContext,
  call: AiCall<T>,
  opts: RunAiOptions = {},
): Promise<T> {
  const maxAttempts = Math.max(1, opts.maxAttempts ?? 3);
  const baseDelayMs = opts.baseDelayMs ?? 500;
  let lastErr: unknown;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const startedAt = Date.now();
    try {
      const { result, usage } = await call();
      logAiRun(log, {
        workflow: ctx.workflow,
        agent: ctx.agent,
        model: usage.model,
        provider: usage.provider,
        tokens_in: usage.tokens_in ?? 0,
        tokens_out: usage.tokens_out ?? 0,
        cost_usd: usage.cost_usd ?? 0,
        latency_ms: usage.latency_ms || Date.now() - startedAt,
        retries: attempt,
        org_id: ctx.org_id,
        brand_id: ctx.brand_id,
        campaign_id: ctx.campaign_id,
        content_item_id: ctx.content_item_id,
        output_version: ctx.output_version,
        status: attempt > 0 ? 'fallback' : 'ok',
      });
      return result;
    } catch (err) {
      lastErr = err;
      const isLast = attempt === maxAttempts - 1;
      logAiRun(log, {
        workflow: ctx.workflow,
        agent: ctx.agent,
        model: 'unknown',
        tokens_in: 0,
        tokens_out: 0,
        cost_usd: 0,
        latency_ms: Date.now() - startedAt,
        retries: attempt,
        org_id: ctx.org_id,
        brand_id: ctx.brand_id,
        campaign_id: ctx.campaign_id,
        content_item_id: ctx.content_item_id,
        status: 'error',
        error: toError(err).message,
      });
      if (isLast) break;
      await sleep(baseDelayMs * 2 ** attempt);
    }
  }
  throw toError(lastErr);
}
