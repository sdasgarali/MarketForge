/**
 * API-app config surface. All values derive from the validated @marketforge/config
 * env singleton — nothing hardcoded. This module only shapes env into the
 * options the HTTP layer (cors, rate-limit, port) consumes.
 */
import { env } from '@marketforge/config';

/** Parse a comma-separated allowlist; empty/undefined => reflect-any in dev only. */
function parseOrigins(raw: string | undefined): string[] | undefined {
  if (!raw) return undefined;
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const apiConfig = {
  port: env.API_PORT,
  isProd: env.isProd,
  isTest: env.isTest,
  isDev: env.isDev,

  /** Allowed CORS origins. In dev/test, fall back to the web base url. */
  corsOrigins: parseOrigins(process.env.API_CORS_ORIGINS) ?? [env.WEB_BASE_URL],

  /** Global rate-limit window + max (per-IP). Sensible enterprise defaults. */
  rateLimit: {
    windowMs: 60_000,
    max: env.isProd ? 300 : 1000,
  },

  /** Body size cap. */
  jsonLimit: '1mb',
} as const;

export type ApiConfig = typeof apiConfig;
