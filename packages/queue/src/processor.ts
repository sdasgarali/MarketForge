/**
 * `registerProcessor` — the mechanism worker apps use to bind a handler to a
 * queue. This package owns the wiring (connection, backoff strategy, payload
 * validation, completion/failure logging); worker apps own the business logic
 * inside the handler.
 */
import { Worker, type Job, type WorkerOptions } from 'bullmq';
import {
  JOB_PAYLOAD_SCHEMAS,
  type JobName,
  type PayloadFor,
} from '@marketforge/contracts';
import { createLogger } from '@marketforge/logger';
import { connection } from './connection.js';
import { JITTERED_BACKOFF, jitteredExponential } from './options.js';

/** Options accepted by {@link registerProcessor}. */
export interface RegisterProcessorOptions {
  /** Max concurrent jobs this worker processes. Default 1. */
  concurrency?: number;
  /** Extra BullMQ WorkerOptions merged last (advanced use). */
  workerOptions?: Partial<WorkerOptions>;
}

/**
 * Create and return a BullMQ Worker bound to the shared connection.
 *
 * - Registers the {@link jitteredExponential} custom backoff strategy under the
 *   {@link JITTERED_BACKOFF} name so jobs using `backoff.type = JITTERED_BACKOFF`
 *   get full-ish jitter.
 * - Validates the incoming payload against `JOB_PAYLOAD_SCHEMAS[name]` BEFORE
 *   invoking the handler — a malformed job fails fast (and is retried/DLQ'd per
 *   the job's options) rather than reaching business logic.
 * - Logs completion and failure with the shared logger.
 *
 * Business logic and DLQ-on-final-failure handling live in the handler / the
 * worker app; this only provides the mechanism.
 */
export function registerProcessor<N extends JobName>(
  name: N,
  handler: (job: Job<PayloadFor<N>>) => Promise<unknown>,
  opts: RegisterProcessorOptions = {},
): Worker<PayloadFor<N>> {
  const log = createLogger({ service: 'queue', workflow: `worker:${name}` });
  const schema = JOB_PAYLOAD_SCHEMAS[name];

  const workerOptions: WorkerOptions = {
    connection,
    concurrency: opts.concurrency ?? 1,
    settings: {
      backoffStrategy: jitteredExponential,
    },
    ...opts.workerOptions,
  };

  const worker = new Worker<PayloadFor<N>>(
    name,
    async (job: Job<PayloadFor<N>>) => {
      // Validate on the way in — reject garbage before business logic runs.
      const data = schema.parse(job.data) as PayloadFor<N>;
      // Re-bind validated (defaulted) data so the handler sees canonical input.
      job.data = data;
      return handler(job);
    },
    workerOptions,
  );

  worker.on('completed', (job: Job<PayloadFor<N>>) => {
    log.debug({ job_id: job.id, job_name: name, attempts: job.attemptsMade }, 'job completed');
  });

  worker.on('failed', (job: Job<PayloadFor<N>> | undefined, err: Error) => {
    log.error(
      {
        job_id: job?.id,
        job_name: name,
        attempts: job?.attemptsMade,
        max_attempts: job?.opts.attempts,
        err: err.message,
      },
      'job failed',
    );
  });

  worker.on('error', (err: Error) => {
    log.error({ job_name: name, err: err.message }, 'worker error');
  });

  return worker;
}

/** BullMQ `Job` type re-exported for handler signatures. */
export type { Job } from 'bullmq';
