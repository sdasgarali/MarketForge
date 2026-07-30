/**
 * Shared job options, retry/backoff policy, priority hints, and dead-letter
 * queue naming for every MarketForge queue.
 */
import { Queue, type DefaultJobOptions, type BackoffStrategy } from 'bullmq';
import { JOB_NAMES, type JobName } from '@marketforge/contracts';
import { connection } from './connection.js';

/** Base delay (ms) for exponential backoff. */
export const BASE_BACKOFF_MS = 5_000;

/** Hard cap for any computed backoff delay (5 minutes). */
export const MAX_BACKOFF_MS = 5 * 60 * 1_000;

/**
 * Default options applied to every enqueued job.
 *
 * - `attempts: 5` — retry a transient failure up to 4 times after the first try.
 * - `backoff: { type: 'exponential', delay: 5000 }` — BullMQ's built-in
 *   exponential backoff. NOTE: BullMQ's built-in exponential backoff adds NO
 *   jitter; every failed job of the same generation retries at the exact same
 *   instant, which can create thundering-herd retries against a rate-limited
 *   upstream. Workers should instead register the {@link jitteredExponential}
 *   custom strategy (via `settings.backoffStrategy`) and reference it by the
 *   `type: JITTERED_BACKOFF` name to get full-ish jitter. We keep the built-in
 *   as the safe default here so a worker that forgets to register the custom
 *   strategy still backs off sensibly.
 * - `removeOnComplete` / `removeOnFail` — bound Redis memory; keep recent
 *   history for debugging (completed: 1h/1000, failed: 24h).
 */
export const defaultJobOptions: DefaultJobOptions = {
  attempts: 5,
  backoff: { type: 'exponential', delay: BASE_BACKOFF_MS },
  removeOnComplete: { age: 3_600, count: 1_000 },
  removeOnFail: { age: 24 * 3_600 },
};

/** Name under which the custom jittered strategy is registered on a Worker. */
export const JITTERED_BACKOFF = 'jitteredExponential' as const;

/**
 * Full-ish jitter exponential backoff strategy.
 *
 * delay = round( 2^attempts * baseDelay * (0.5 + rand*0.5) ), capped at
 * {@link MAX_BACKOFF_MS}. `attemptsMade` is 1-based when BullMQ invokes this.
 *
 * Register on a Worker: `new Worker(name, fn, { settings: { backoffStrategy } })`
 * and set job `backoff: { type: JITTERED_BACKOFF, delay: BASE_BACKOFF_MS }`.
 */
export const jitteredExponential: BackoffStrategy = (
  attemptsMade: number,
  _type?: string,
  _err?: Error,
): number => {
  const baseDelay = BASE_BACKOFF_MS;
  const exp = Math.pow(2, attemptsMade) * baseDelay;
  const jittered = exp * (0.5 + Math.random() * 0.5);
  return Math.min(MAX_BACKOFF_MS, Math.round(jittered));
};

/**
 * Per-queue priority hints. In BullMQ a LOWER number = HIGHER priority.
 * `publish` is the most time-sensitive (scheduled posts must go out on time);
 * `generate-video` is the heaviest/least urgent and yields to everything else.
 */
export const jobPriority: Record<JobName, number> = {
  publish: 1,
  notify: 2,
  review: 3,
  research: 4,
  'generate-text': 5,
  'generate-image': 6,
  analytics: 7,
  'drive-mirror': 8,
  'generate-video': 9,
};

/** Suffix appended to a job name to form its dead-letter queue name. */
export const DLQ_SUFFIX = ':dlq' as const;

/**
 * Dead-letter queue name for a given job name.
 *
 * DLQ concept: on FINAL failure (attempts exhausted), a worker MAY move the job
 * payload into a `<name>:dlq` queue for manual inspection / replay. Moving the
 * job is the worker's responsibility — this package only owns the naming and a
 * factory to obtain the DLQ instance.
 */
export function deadLetterQueueName(name: JobName): string {
  return `${name}${DLQ_SUFFIX}`;
}

/** Cache of DLQ Queue instances keyed by DLQ name. */
const dlqRegistry = new Map<string, Queue>();

/**
 * Get (or lazily create) the dead-letter Queue for a job name. DLQ jobs are
 * kept indefinitely by default (no removeOnComplete/Fail) so nothing is lost.
 */
export function getDeadLetterQueue(name: JobName): Queue {
  const dlqName = deadLetterQueueName(name);
  let queue = dlqRegistry.get(dlqName);
  if (!queue) {
    queue = new Queue(dlqName, { connection });
    dlqRegistry.set(dlqName, queue);
  }
  return queue;
}

/** All dead-letter queue names, one per JobName. */
export const DLQ_NAMES: readonly string[] = JOB_NAMES.map(deadLetterQueueName);
