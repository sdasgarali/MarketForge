/**
 * Liveness + readiness probes (no auth). `/health` is a cheap liveness check;
 * `/ready` verifies the two hard dependencies — Postgres and Redis — are
 * reachable, so orchestrators only route traffic when the app can actually serve.
 */
import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { db } from '@marketforge/db';
import { connection } from '@marketforge/queue';
import { asyncHandler } from '../../lib/async-handler.js';

export const healthRouter: Router = Router();

healthRouter.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'api', time: new Date().toISOString() });
});

healthRouter.get(
  '/ready',
  asyncHandler(async (_req, res) => {
    const checks: Record<string, 'ok' | 'error'> = { db: 'error', redis: 'error' };

    // DB check: trivial round-trip. Not tenant-scoped (no RLS tables touched).
    try {
      await db.execute(sql`SELECT 1`);
      checks.db = 'ok';
    } catch {
      checks.db = 'error';
    }

    // Redis check: PING the shared BullMQ connection.
    try {
      const pong = await connection.ping();
      checks.redis = pong === 'PONG' ? 'ok' : 'error';
    } catch {
      checks.redis = 'error';
    }

    const healthy = checks.db === 'ok' && checks.redis === 'ok';
    res.status(healthy ? 200 : 503).json({ status: healthy ? 'ready' : 'degraded', checks });
  }),
);
