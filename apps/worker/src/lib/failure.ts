/**
 * Terminal-failure routing. On a non-retryable failure (or after BullMQ has
 * exhausted its retries), a processor calls {@link routeToDlq} to:
 *   1. move the job payload into the `<name>:dlq` queue for manual inspection;
 *   2. enqueue a `notify` job (failure) so an operator is alerted;
 *   3. write an audit_log row.
 * Idempotent-ish: DLQ jobs are keyed by the source job id to avoid dupes.
 */
import { getDeadLetterQueue, enqueueNotify } from '@marketforge/queue';
import type { JobName } from '@marketforge/contracts';
import { db, withTenant } from '@marketforge/db';
import type { Logger } from '@marketforge/logger';
import { writeAudit } from './audit.js';
import { toError } from './errors.js';

export interface DlqContext {
  jobName: JobName;
  jobId?: string;
  orgId: string;
  brandId?: string;
  payload: unknown;
  error: unknown;
  log: Logger;
}

/**
 * Route a terminally-failed job to its dead-letter queue, alert via notify, and
 * audit. Never throws — failure handling must not itself fail the worker.
 */
export async function routeToDlq(ctx: DlqContext): Promise<void> {
  const err = toError(ctx.error);
  const { jobName, jobId, orgId, brandId, payload, log } = ctx;

  // 1) Move to DLQ (best-effort). Use the source job id for the DLQ jobId so a
  //    replayed/duplicate final-failure does not fan out multiple DLQ entries.
  try {
    const dlq = getDeadLetterQueue(jobName);
    await dlq.add(
      `${jobName}:dlq`,
      {
        original: payload,
        error: { message: err.message, stack: err.stack },
        failedAt: new Date().toISOString(),
        jobName,
        sourceJobId: jobId,
      },
      jobId ? { jobId: `dlq:${jobName}:${jobId}` } : undefined,
    );
  } catch (dlqErr) {
    log.error({ err: toError(dlqErr).message, jobName, jobId }, 'failed to route job to DLQ');
  }

  // 2) Alert an operator via the notify pipeline (dashboard is always available).
  try {
    await enqueueNotify({
      org_id: orgId,
      brand_id: brandId,
      channel: 'dashboard',
      type: 'failure',
      title: `Job failed: ${jobName}`,
      body: err.message.slice(0, 500),
      attempt_reason: 'initial',
      payload: { jobName, jobId: jobId ?? null },
    });
  } catch (notifyErr) {
    log.error({ err: toError(notifyErr).message }, 'failed to enqueue failure notification');
  }

  // 3) Audit trail.
  try {
    await withTenant(db, orgId, async (tx) => {
      await writeAudit(tx, orgId, {
        action: 'job.terminal_failure',
        entityType: 'queue_job',
        entityId: jobId,
        after: { jobName, error: err.message } as unknown as never,
      });
    });
  } catch (auditErr) {
    log.error({ err: toError(auditErr).message }, 'failed to write terminal-failure audit');
  }

  log.error({ jobName, jobId, org_id: orgId, err: err.message }, 'job routed to DLQ (terminal failure)');
}
