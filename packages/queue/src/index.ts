/**
 * @marketforge/queue — BullMQ setup for MarketForge.
 *
 *   import { enqueue, scheduler, registerProcessor } from '@marketforge/queue';
 *
 *   // enqueue immediately (validated against the contract schema)
 *   await enqueue('publish', { org_id, content_item_id, platforms: ['x'] });
 *
 *   // schedule a delayed job (backend owns the clock — ADR-004)
 *   await scheduler.scheduleAt('publish', payload, { at: '2026-08-01T09:00:00Z' });
 *
 *   // in a worker app — bind a handler (business logic is yours)
 *   registerProcessor('publish', async (job) => { ... }, { concurrency: 4 });
 *
 * One Queue per JobName, one shared Redis connection, typed enqueue helpers,
 * retries with exponential backoff (+ optional jitter strategy), and a
 * dead-letter-queue naming convention (`<name>:dlq`).
 */

// Connection
export { createRedisConnection, connection, bullConnectionOptions } from './connection.js';

// Queues registry + accessor
export { queues, getQueue, type QueueRegistry } from './queues.js';

// Enqueue helpers
export {
  enqueue,
  enqueueResearch,
  enqueueGenerateText,
  enqueueGenerateImage,
  enqueueGenerateVideo,
  enqueueReview,
  enqueuePublish,
  enqueueAnalytics,
  enqueueDriveMirror,
  enqueueNotify,
} from './enqueue.js';

// Scheduler (delayed jobs + idempotency)
export {
  Scheduler,
  scheduler,
  computeDelayMs,
  type ScheduleWhen,
  type ScheduleResult,
} from './scheduler.js';

// Processor registration (worker apps call this)
export {
  registerProcessor,
  type RegisterProcessorOptions,
  type Job,
} from './processor.js';

// Options: job defaults, backoff strategy, priority map, DLQ helpers
export {
  defaultJobOptions,
  jitteredExponential,
  JITTERED_BACKOFF,
  BASE_BACKOFF_MS,
  MAX_BACKOFF_MS,
  jobPriority,
  DLQ_SUFFIX,
  DLQ_NAMES,
  deadLetterQueueName,
  getDeadLetterQueue,
} from './options.js';

// Global emergency kill switch
export {
  engageKillSwitch,
  clearKillSwitch,
  isKillSwitchEngaged,
  killSwitchStatus,
  type KillSwitchStatus,
} from './killswitch.js';

// Convenience re-exports from contracts
export { JOB_NAMES } from '@marketforge/contracts';
export type { JobName, PayloadFor } from '@marketforge/contracts';
