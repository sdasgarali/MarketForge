/**
 * Typed enqueue helpers. Every enqueue validates the payload against its Zod
 * schema (fail-fast, never enqueue garbage) and logs at debug level.
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

const log = createLogger({ service: 'queue' });

/**
 * Enqueue a job. Validates `payload` with `JOB_PAYLOAD_SCHEMAS[name]` (throws
 * a ZodError on mismatch), applies the per-queue priority hint unless the
 * caller overrides it, then adds the job to its queue.
 *
 * @returns the created job's id (string).
 */
export async function enqueue<N extends JobName>(
  name: N,
  payload: PayloadFor<N>,
  opts: JobsOptions = {},
): Promise<string> {
  // Validate + apply schema defaults. Result is the same runtime shape as PayloadFor<N>.
  const data = JOB_PAYLOAD_SCHEMAS[name].parse(payload) as PayloadFor<N>;

  // BullMQ's Queue.add types its first arg as the queue's Name generic
  // (`ExtractNameType<Data>`), which does not accept a plain string across our
  // generic registry. Access via the untyped base Queue signature.
  const queue = getQueue(name) as unknown as {
    add(name: string, data: unknown, opts?: JobsOptions): Promise<{ id?: string }>;
  };
  const jobOpts: JobsOptions = { priority: jobPriority[name], ...opts };
  const job = await queue.add(name, data, jobOpts);

  log.debug(
    {
      job_name: name,
      job_id: job.id,
      org_id: data.org_id,
      brand_id: data.brand_id,
      priority: jobOpts.priority,
    },
    'enqueued job',
  );

  // BullMQ always assigns an id once the job is added.
  return job.id ?? '';
}

// --- Convenience named helpers (one per JobName) ---

/** Enqueue a `research` job. */
export const enqueueResearch = (payload: PayloadFor<'research'>, opts?: JobsOptions): Promise<string> =>
  enqueue('research', payload, opts);

/** Enqueue a `generate-text` job. */
export const enqueueGenerateText = (payload: PayloadFor<'generate-text'>, opts?: JobsOptions): Promise<string> =>
  enqueue('generate-text', payload, opts);

/** Enqueue a `generate-image` job. */
export const enqueueGenerateImage = (payload: PayloadFor<'generate-image'>, opts?: JobsOptions): Promise<string> =>
  enqueue('generate-image', payload, opts);

/** Enqueue a `generate-video` job. */
export const enqueueGenerateVideo = (payload: PayloadFor<'generate-video'>, opts?: JobsOptions): Promise<string> =>
  enqueue('generate-video', payload, opts);

/** Enqueue a `review` job. */
export const enqueueReview = (payload: PayloadFor<'review'>, opts?: JobsOptions): Promise<string> =>
  enqueue('review', payload, opts);

/** Enqueue a `publish` job. */
export const enqueuePublish = (payload: PayloadFor<'publish'>, opts?: JobsOptions): Promise<string> =>
  enqueue('publish', payload, opts);

/** Enqueue an `analytics` job. */
export const enqueueAnalytics = (payload: PayloadFor<'analytics'>, opts?: JobsOptions): Promise<string> =>
  enqueue('analytics', payload, opts);

/** Enqueue a `drive-mirror` job. */
export const enqueueDriveMirror = (payload: PayloadFor<'drive-mirror'>, opts?: JobsOptions): Promise<string> =>
  enqueue('drive-mirror', payload, opts);

/** Enqueue a `notify` job. */
export const enqueueNotify = (payload: PayloadFor<'notify'>, opts?: JobsOptions): Promise<string> =>
  enqueue('notify', payload, opts);
