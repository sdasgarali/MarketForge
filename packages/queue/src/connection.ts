/**
 * Redis connection factory + shared singleton for BullMQ.
 *
 * BullMQ requires `maxRetriesPerRequest: null` on the underlying ioredis
 * client (blocking commands like BRPOPLPUSH must not be capped), otherwise it
 * throws at startup. We reuse ONE ioredis instance across every Queue, Worker,
 * and QueueEvents to avoid exhausting Redis connections (ADR-008: one Redis).
 */
import { Redis, type RedisOptions } from 'ioredis';
import { env } from '@marketforge/config';

/**
 * Options mandated by BullMQ for any connection used by Queues/Workers.
 * `maxRetriesPerRequest: null` is REQUIRED. `enableReadyCheck` is left default.
 */
export const bullConnectionOptions: RedisOptions = {
  maxRetriesPerRequest: null,
};

/**
 * Create a fresh ioredis connection wired for BullMQ. Prefer the shared
 * {@link connection} singleton; use this only when you deliberately need an
 * isolated client (e.g. tests, a dedicated subscriber).
 *
 * @param overrides - extra ioredis options merged over the BullMQ defaults.
 */
export function createRedisConnection(overrides: RedisOptions = {}): Redis {
  return new Redis(env.REDIS_URL, {
    ...bullConnectionOptions,
    ...overrides,
  });
}

/**
 * Process-wide shared connection. All queues/workers reuse this instance.
 * Lazily connects on first command (ioredis default) so importing this module
 * does not force a socket open at import time.
 */
export const connection: Redis = createRedisConnection();
