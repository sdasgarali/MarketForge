/**
 * Shared processor scaffolding. `defineProcessor` wraps a business handler with:
 *  - a scoped logger (service=worker, job context);
 *  - terminal-failure detection → route to DLQ + notify + audit (no BullMQ retry);
 *  - transient failures rethrown so BullMQ retries with jittered backoff;
 *  - a "final attempt" check so an exhausted transient job is also DLQ'd.
 *
 * The queue package already validates the payload against its Zod schema before
 * the handler runs, so handlers receive canonical, defaulted input.
 */
import { type Job, isKillSwitchEngaged } from '@marketforge/queue';
import type { JobName, PayloadFor } from '@marketforge/contracts';
import { createLogger, type Logger } from '@marketforge/logger';
import { SERVICE } from '../lib/constants.js';
import { isTerminalError, TerminalError, toError } from '../lib/errors.js';
import { routeToDlq } from '../lib/failure.js';

export interface ProcessorCtx<N extends JobName> {
  job: Job<PayloadFor<N>>;
  payload: PayloadFor<N>;
  log: Logger;
}

export type Handler<N extends JobName> = (ctx: ProcessorCtx<N>) => Promise<unknown>;

/**
 * Build a BullMQ handler for a job name with unified failure routing.
 */
export function defineProcessor<N extends JobName>(name: N, handler: Handler<N>) {
  return async (job: Job<PayloadFor<N>>): Promise<unknown> => {
    const payload = job.data;
    const log = createLogger({
      service: SERVICE,
      workflow: name,
      job_id: job.id,
      org_id: (payload as { org_id?: string }).org_id,
      brand_id: (payload as { brand_id?: string }).brand_id,
    });

    try {
      // Emergency kill switch: abort immediately if the operator force-stopped
      // the pipelines. Terminal → the job is DLQ'd, not retried.
      if (await isKillSwitchEngaged()) {
        throw new TerminalError('kill switch engaged — pipeline force-stopped');
      }
      return await handler({ job, payload, log });
    } catch (err) {
      const error = toError(err);
      const attemptsMade = job.attemptsMade + 1; // attemptsMade is 0-based before this attempt is counted
      const maxAttempts = job.opts.attempts ?? 1;
      const terminal = isTerminalError(err);
      const exhausted = attemptsMade >= maxAttempts;

      if (terminal || exhausted) {
        await routeToDlq({
          jobName: name,
          jobId: job.id,
          orgId: (payload as { org_id: string }).org_id,
          brandId: (payload as { brand_id?: string }).brand_id,
          payload,
          error,
          log,
        });
        // For a terminal error, do NOT let BullMQ keep retrying: swallow so the
        // job "completes" (already DLQ'd). For an exhausted transient error we
        // still rethrow so BullMQ marks it failed (it won't retry past attempts).
        if (terminal) return { dlq: true, terminal: true };
      }
      throw error;
    }
  };
}
