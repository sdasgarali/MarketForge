/**
 * Worker boot — registers every processor, starts the health server, and wires
 * graceful shutdown (close workers → close Redis → exit). This process IS the
 * content pipeline (research → generate → review → publish → analytics).
 *
 * Env:
 *   WORKER_HEALTH_PORT   health/readiness HTTP port (default 9090)
 *   WORKER_ENABLE_VIDEO  'true' to enable the gated generate-video processor
 */
import type { Worker } from 'bullmq';
import { connection } from '@marketforge/queue';
import { createLogger } from '@marketforge/logger';
import { SERVICE } from './lib/constants.js';
import { startHealthServer, type HealthState } from './lib/health.js';
import { PROCESSORS } from './processors/index.js';

const log = createLogger({ service: SERVICE, workflow: 'boot' });

async function main(): Promise<void> {
  const workers: Worker[] = [];
  const state: HealthState = { ready: false, shuttingDown: false, workers: 0 };

  for (const p of PROCESSORS) {
    // `registerProcessor` validates the payload + wires jittered backoff.
    const worker = p.register();
    workers.push(worker);
    log.info({ queue: p.name, concurrency: p.concurrency }, 'processor registered');
  }
  state.workers = workers.length;
  state.ready = true;

  const healthPort = Number(process.env.WORKER_HEALTH_PORT ?? 9090);
  const health = startHealthServer(healthPort, state);

  log.info({ processors: workers.length, healthPort }, 'worker started');

  // --- Graceful shutdown ---------------------------------------------------
  let shuttingDown = false;
  const shutdown = async (signal: string): Promise<void> => {
    if (shuttingDown) return;
    shuttingDown = true;
    state.shuttingDown = true;
    state.ready = false;
    log.info({ signal }, 'shutting down worker (draining active jobs)');

    // Stop accepting new jobs and let in-flight jobs finish.
    await Promise.allSettled(workers.map((w) => w.close()));
    health.close();
    // Close the shared Redis connection last.
    try {
      await connection.quit();
    } catch {
      connection.disconnect();
    }
    log.info('worker shutdown complete');
    // Give loggers a tick to flush.
    setTimeout(() => process.exit(0), 50);
  };

  for (const sig of ['SIGTERM', 'SIGINT'] as const) {
    process.on(sig, () => {
      void shutdown(sig);
    });
  }

  process.on('unhandledRejection', (reason) => {
    log.error({ reason: String(reason) }, 'unhandledRejection');
  });
  process.on('uncaughtException', (err) => {
    log.error({ err: err.message, stack: err.stack }, 'uncaughtException');
  });
}

main().catch((err: unknown) => {
  log.error({ err: err instanceof Error ? err.message : String(err) }, 'worker failed to start');
  process.exit(1);
});
