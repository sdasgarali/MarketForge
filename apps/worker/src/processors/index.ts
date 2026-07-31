/**
 * Processor registry. Maps each JobName to its handler + concurrency. The boot
 * sequence (src/index.ts) registers every entry via `registerProcessor`.
 *
 * Concurrency reflects cost/rate profiles: cheap/fast jobs run wider; expensive
 * AI + rate-limited external calls run narrow.
 */
import type { JobName, PayloadFor } from '@marketforge/contracts';
import { registerProcessor, type Job } from '@marketforge/queue';
import type { Worker } from 'bullmq';
import { orchestrateProcessor } from './orchestrate.js';
import { researchProcessor } from './research.js';
import { generateTextProcessor } from './generate-text.js';
import { generateImageProcessor } from './generate-image.js';
import { generateVideoProcessor } from './generate-video.js';
import { reviewProcessor } from './review.js';
import { publishProcessor } from './publish.js';
import { analyticsProcessor } from './analytics.js';
import { driveMirrorProcessor } from './drive-mirror.js';
import { notifyProcessor } from './notify.js';

/**
 * A registration closure captures its JobName generic so `registerProcessor`
 * is called with matching handler/payload types (avoids the union-widening the
 * plain tuple would otherwise cause).
 */
export interface ProcessorRegistration {
  name: JobName;
  concurrency: number;
  register: () => Worker;
}

function make<N extends JobName>(
  name: N,
  handler: (job: Job<PayloadFor<N>>) => Promise<unknown>,
  concurrency: number,
): ProcessorRegistration {
  return {
    name,
    concurrency,
    register: () => registerProcessor(name, handler, { concurrency }) as unknown as Worker,
  };
}

export const PROCESSORS: readonly ProcessorRegistration[] = [
  make('orchestrate', orchestrateProcessor, 4),
  make('research', researchProcessor, 4),
  make('generate-text', generateTextProcessor, 4),
  make('generate-image', generateImageProcessor, 3),
  make('generate-video', generateVideoProcessor, 1),
  make('review', reviewProcessor, 4),
  make('publish', publishProcessor, 4),
  make('analytics', analyticsProcessor, 4),
  make('drive-mirror', driveMirrorProcessor, 2),
  make('notify', notifyProcessor, 6),
];
