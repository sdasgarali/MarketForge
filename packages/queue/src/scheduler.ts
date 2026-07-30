/**
 * Backend-owned Scheduler for DELAYED jobs (ADR-004: BullMQ delayed jobs own
 * the clock, NOT n8n). Given an absolute target instant, it computes the delay
 * and enqueues a delayed job with a stable idempotency key used as the BullMQ
 * `jobId` so re-scheduling the same logical job dedupes.
 *
 * Timezone note (dependency-free): callers pass an ABSOLUTE instant for `at`
 * (either a `Date`, or an ISO-8601 string WITH an offset/`Z`). The `timezone`
 * field is metadata only — it is recorded on logs and folded into the
 * idempotency key so "the same post scheduled for the same local day" dedupes
 * even if the absolute instant is recomputed slightly differently. We do NOT
 * interpret a naive local wall-clock time; that ambiguity is resolved upstream.
 */
import type { JobsOptions } from 'bullmq';
import {
  JOB_PAYLOAD_SCHEMAS,
  type JobName,
  type PayloadFor,
} from '@marketforge/contracts';
import { createLogger } from '@marketforge/logger';
import { getQueue } from './queues.js';
import { jobPriority } from './options.js';

/** How to express when a delayed job should run. */
export interface ScheduleWhen {
  /** Absolute instant: a Date, or ISO-8601 string with offset (`...Z`/`+05:00`). */
  at: Date | string;
  /** IANA timezone (e.g. `Asia/Karachi`). Metadata for logs + idempotency only. */
  timezone?: string;
}

/** Result of a schedule call. */
export interface ScheduleResult {
  /** BullMQ job id (equals the idempotency key). */
  jobId: string;
  /** The idempotency key used for dedupe. */
  idempotencyKey: string;
  /** Delay in ms from scheduling time to target instant (>= 0). */
  delayMs: number;
  /** Target instant as an ISO string. */
  targetInstantISO: string;
  /** True if BullMQ reported an existing job with this id (duplicate). */
  duplicate: boolean;
}

/**
 * Compute the delay (ms) from `now` until `at`, clamped to 0 (never negative —
 * a past instant runs immediately).
 */
export function computeDelayMs(at: Date | string, now: number = Date.now()): number {
  const target = at instanceof Date ? at.getTime() : new Date(at).getTime();
  if (Number.isNaN(target)) {
    throw new TypeError(`Scheduler: invalid \`at\` instant: ${String(at)}`);
  }
  return Math.max(0, target - now);
}

/** Narrow a payload to see if it carries an optional content_item_id. */
function contentItemId(payload: { content_item_id?: string }): string {
  return payload.content_item_id ?? '';
}

export class Scheduler {
  private readonly log = createLogger({ service: 'queue', workflow: 'scheduler' });

  /**
   * Schedule a job to run at an absolute instant.
   *
   * Builds (or reuses) a stable idempotency key and passes it as the BullMQ
   * `jobId`; BullMQ dedupes on `jobId`, so re-scheduling the same logical job
   * returns the existing job rather than creating a duplicate.
   *
   * @returns the job id / idempotency key and computed delay.
   */
  async scheduleAt<N extends JobName>(
    name: N,
    payload: PayloadFor<N>,
    when: ScheduleWhen,
    opts: JobsOptions = {},
  ): Promise<ScheduleResult> {
    // Validate + apply defaults first.
    const data = JOB_PAYLOAD_SCHEMAS[name].parse(payload) as PayloadFor<N> & {
      org_id: string;
      content_item_id?: string;
      idempotency_key?: string;
    };

    const now = Date.now();
    const target = when.at instanceof Date ? when.at : new Date(when.at);
    if (Number.isNaN(target.getTime())) {
      throw new TypeError(`Scheduler: invalid \`at\` instant: ${String(when.at)}`);
    }
    const targetInstantISO = target.toISOString();
    const delayMs = computeDelayMs(target, now);

    const idempotencyKey =
      data.idempotency_key ??
      [name, data.org_id, contentItemId(data), targetInstantISO].join(':');

    const jobOpts: JobsOptions = {
      priority: jobPriority[name],
      ...opts,
      delay: delayMs,
      jobId: idempotencyKey,
    };

    // Access via the untyped base Queue signature (see enqueue.ts note): the
    // generic registry cannot satisfy BullMQ's ExtractNameType<Data> add arg.
    const queue = getQueue(name) as unknown as {
      add(
        name: string,
        data: unknown,
        opts?: JobsOptions,
      ): Promise<{ id?: string; timestamp: number }>;
    };
    const job = await queue.add(name, data, jobOpts);

    // BullMQ dedupes on jobId: if a job with this id already existed, `add`
    // returns that job (its id equals our key). We flag it so callers/logs can
    // distinguish a fresh schedule from a no-op re-schedule.
    const duplicate = job.id === idempotencyKey && (await this.isPreexisting(job.timestamp, now));

    if (duplicate) {
      this.log.warn(
        { job_name: name, job_id: job.id, org_id: data.org_id, idempotency_key: idempotencyKey },
        'duplicate schedule detected — reusing existing delayed job (dedupe on jobId)',
      );
    } else {
      this.log.debug(
        {
          job_name: name,
          job_id: job.id,
          org_id: data.org_id,
          timezone: when.timezone,
          delay_ms: delayMs,
          run_at: targetInstantISO,
        },
        'scheduled delayed job',
      );
    }

    return {
      jobId: job.id ?? idempotencyKey,
      idempotencyKey,
      delayMs,
      targetInstantISO,
      duplicate,
    };
  }

  /**
   * Schedule a job to run after a relative delay (ms). Idempotency key is
   * derived from the resulting absolute instant.
   */
  async scheduleIn<N extends JobName>(
    name: N,
    payload: PayloadFor<N>,
    delayMs: number,
    opts: JobsOptions = {},
    timezone?: string,
  ): Promise<ScheduleResult> {
    const at = new Date(Date.now() + Math.max(0, delayMs));
    return this.scheduleAt(name, payload, timezone ? { at, timezone } : { at }, opts);
  }

  /**
   * Heuristic: a job whose creation timestamp predates this scheduling call
   * already existed (BullMQ returned the existing job on a duplicate jobId).
   */
  private isPreexisting(jobTimestamp: number, now: number): boolean {
    return jobTimestamp < now;
  }
}

/** Shared Scheduler instance for convenience. */
export const scheduler = new Scheduler();
