/**
 * HTTP server lifecycle: start listening + graceful shutdown. Kept separate from
 * app.ts so the app can be imported by tests (supertest) without opening a socket.
 */
import type { Server } from 'node:http';
import { createLogger } from '@marketforge/logger';
import { createApp } from './app.js';
import { apiConfig } from './config/index.js';

const log = createLogger({ service: 'api' });

export function startServer(): Server {
  const app = createApp();
  const server = app.listen(apiConfig.port, () => {
    log.info({ port: apiConfig.port, env: process.env.APP_ENV }, 'API listening');
  });

  const shutdown = (signal: string) => {
    log.info({ signal }, 'shutting down');
    server.close((err) => {
      if (err) {
        log.error({ err }, 'error during shutdown');
        process.exit(1);
      }
      process.exit(0);
    });
    // Force-exit if graceful close hangs.
    setTimeout(() => process.exit(1), 10_000).unref();
  };

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  return server;
}
