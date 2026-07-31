/**
 * Liveness + readiness probes (no auth). `/health` is a cheap liveness check;
 * `/ready` verifies the two hard dependencies — Postgres and Redis — are
 * reachable, so orchestrators only route traffic when the app can actually serve.
 */
import { Router } from 'express';
import { sql } from 'drizzle-orm';
import { env } from '@marketforge/config';
import { db } from '@marketforge/db';
import { connection } from '@marketforge/queue';
import { asyncHandler } from '../../lib/async-handler.js';

export const healthRouter: Router = Router();

/**
 * Public root. This host is an API, not a website — a human hitting it in a
 * browser would otherwise get a 401 from the authed routes and think it's
 * broken. So browser visits (Accept: text/html) are redirected to the web app;
 * programmatic clients get a small JSON banner. No auth (mounted before authContext).
 */
healthRouter.get('/', (req, res) => {
  const appUrl = env.WEB_BASE_URL;
  if ((req.headers.accept ?? '').includes('text/html')) {
    res.redirect(302, appUrl);
    return;
  }
  res.json({ service: 'marketforge-api', status: 'ok', app: appUrl });
});

// Browsers auto-request /favicon.ico; answer 204 so it isn't a noisy 401.
healthRouter.get('/favicon.ico', (_req, res) => {
  res.status(204).end();
});

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
