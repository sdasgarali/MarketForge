/**
 * One BullMQ Queue per JobName, wired to the shared connection and the
 * platform default job options. The JobName string values ARE the queue names
 * (ADR-008) — do not rename.
 */
import { Queue } from 'bullmq';
import { JOB_NAMES, type JobName, type PayloadFor } from '@marketforge/contracts';
import { connection } from './connection.js';
import { defaultJobOptions } from './options.js';

/** Typed registry: each JobName maps to a Queue carrying its payload type. */
export type QueueRegistry = { [N in JobName]: Queue<PayloadFor<N>> };

function buildQueues(): QueueRegistry {
  const registry = {} as QueueRegistry;
  for (const name of JOB_NAMES) {
    // Cast: BullMQ's Queue<T> is invariant in T; the loop erases the per-name
    // literal, so we assert the correct element type back onto the registry.
    (registry as Record<JobName, Queue>)[name] = new Queue(name, {
      connection,
      defaultJobOptions,
    });
  }
  return registry;
}

/** Process-wide queue registry — one Queue instance per JobName. */
export const queues: QueueRegistry = buildQueues();

/** Typed accessor for a single queue by name. */
export function getQueue<N extends JobName>(name: N): Queue<PayloadFor<N>> {
  return queues[name];
}
