/**
 * Minimal HTTP health server (dependency-free `node:http`). Exposes:
 *   GET /health   → 200 when the process is up and Redis reachable.
 *   GET /ready    → 200 when workers are registered and not shutting down.
 * Used by Docker/K8s liveness+readiness probes.
 */
import { createServer, type Server } from 'node:http';
import { connection } from '@marketforge/queue';
import { createLogger } from '@marketforge/logger';
import { SERVICE } from './constants.js';

const log = createLogger({ service: SERVICE, workflow: 'health' });

export interface HealthState {
  ready: boolean;
  shuttingDown: boolean;
  workers: number;
}

export function startHealthServer(port: number, state: HealthState): Server {
  const server = createServer((req, res) => {
    const url = req.url ?? '/';
    if (url.startsWith('/health')) {
      const redisOk = connection.status === 'ready' || connection.status === 'connecting';
      const ok = redisOk && !state.shuttingDown;
      res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ status: ok ? 'ok' : 'degraded', redis: connection.status, workers: state.workers }));
      return;
    }
    if (url.startsWith('/ready')) {
      const ok = state.ready && !state.shuttingDown;
      res.writeHead(ok ? 200 : 503, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ ready: ok, workers: state.workers }));
      return;
    }
    res.writeHead(404, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ error: 'not_found' }));
  });

  server.listen(port, () => log.info({ port }, 'health server listening'));
  server.on('error', (err) => log.error({ err: err.message }, 'health server error'));
  return server;
}
