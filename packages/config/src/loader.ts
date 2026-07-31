import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';
import { APP_ENVS, type AppEnv, type Env, envSchema } from './schema.js';

/**
 * Locate the repo-root `.env` by walking up from `process.cwd()`.
 *
 * dotenv only reads `${cwd}/.env`, but our entrypoints run from package dirs
 * (e.g. `pnpm --filter @marketforge/db ...` or turbo tasks with cwd=apps/api),
 * where no local `.env` exists. Walking up to the single repo-root `.env` makes
 * env loading work regardless of which package launched the process. Returns
 * `undefined` when no `.env` is found (dotenv then falls back to its default).
 */
function findEnvFile(): string | undefined {
  let dir = process.cwd();
  // Bounded walk to filesystem root (dirname is idempotent at the root).
  for (;;) {
    const candidate = join(dir, '.env');
    if (existsSync(candidate)) return candidate;
    const parent = dirname(dir);
    if (parent === dir) return undefined;
    dir = parent;
  }
}

/**
 * Thrown when environment validation fails. Aggregates all issues so operators
 * see every missing/invalid key at once (fail-fast, but not one-at-a-time).
 */
export class EnvValidationError extends Error {
  public readonly issues: string[];
  constructor(issues: string[]) {
    super(
      `Invalid environment configuration:\n${issues.map((i) => `  - ${i}`).join('\n')}\n` +
        'Check your .env against .env.example (APP_ENV prefix scheme applies).',
    );
    this.name = 'EnvValidationError';
    this.issues = issues;
  }
}

/**
 * Resolve a canonical env value using the APP_ENV prefix scheme:
 *   1. `${APP_ENV}_${key}`  (e.g. DEV_DATABASE_URL)
 *   2. bare `${key}`        (fallback / local one-offs)
 */
function resolveValue(
  raw: NodeJS.ProcessEnv,
  appEnv: AppEnv,
  key: string,
): string | undefined {
  const prefixed = raw[`${appEnv}_${key}`];
  if (prefixed !== undefined && prefixed !== '') return prefixed;
  const bare = raw[key];
  if (bare !== undefined && bare !== '') return bare;
  return undefined;
}

/**
 * OS-aware data dir. Tries `${APP_ENV}_DATA_DIR_WIN|LINUX` then bare, picking
 * the suffix by platform. Returns a sane default if unset.
 */
function resolveDataDir(raw: NodeJS.ProcessEnv, appEnv: AppEnv): string {
  const suffix = process.platform === 'win32' ? 'WIN' : 'LINUX';
  const prefixed = raw[`${appEnv}_DATA_DIR_${suffix}`];
  if (prefixed) return prefixed;
  const bare = raw[`DATA_DIR_${suffix}`];
  if (bare) return bare;
  return process.platform === 'win32' ? '.\\.data' : './.data';
}

function readAppEnv(raw: NodeJS.ProcessEnv): AppEnv {
  const value = raw.APP_ENV;
  if (!value || !(APP_ENVS as readonly string[]).includes(value)) {
    throw new EnvValidationError([
      `APP_ENV must be one of ${APP_ENVS.join(' | ')} (got: ${value ?? 'undefined'})`,
    ]);
  }
  return value as AppEnv;
}

/**
 * Populate `process.env` from the repo-root `.env` WITHOUT validating the
 * schema. For raw scripts (migrations, one-off CLIs) that read a few keys
 * directly and must not trigger full fail-fast config validation. Idempotent
 * and safe to call before `loadEnv`. Returns the `.env` path used, if any.
 */
export function loadRootEnv(): string | undefined {
  const path = findEnvFile();
  loadDotenv({ path });
  return path;
}

let cached: Env | undefined;

export interface LoadEnvOptions {
  /** If true, ignore the cache and re-read (used in tests). */
  reload?: boolean;
  /** Skip reading a .env file (env already injected by the platform). */
  skipDotenv?: boolean;
  /** Explicit env source (defaults to process.env). */
  source?: NodeJS.ProcessEnv;
}

/**
 * Load, resolve (APP_ENV prefix), validate (Zod), and freeze the environment.
 * Fail-fast: throws EnvValidationError aggregating every problem.
 */
export function loadEnv(options: LoadEnvOptions = {}): Env {
  if (cached && !options.reload) return cached;

  if (!options.skipDotenv) {
    // Populates process.env from the repo-root .env if present; does not
    // override existing keys. Walks up from cwd so it works from any package.
    loadDotenv({ path: findEnvFile() });
  }

  const raw = options.source ?? process.env;
  const appEnv = readAppEnv(raw);

  // Build a canonical object by resolving each schema key via the prefix scheme.
  const resolved: Record<string, string | undefined> = { APP_ENV: appEnv };
  for (const key of Object.keys(envSchema.shape)) {
    if (key === 'APP_ENV') continue;
    resolved[key] = resolveValue(raw, appEnv, key);
  }

  // Back-compat: the legacy `WORKER_ENABLE_VIDEO` gate maps onto `VIDEO_ENABLED`.
  // If the new key is not set but the legacy one is, honour the legacy value so
  // existing deployments keep working. The new key always wins when both exist.
  if (resolved.VIDEO_ENABLED === undefined && resolved.WORKER_ENABLE_VIDEO !== undefined) {
    resolved.VIDEO_ENABLED = resolved.WORKER_ENABLE_VIDEO;
  }

  const parsed = envSchema.safeParse(resolved);
  if (!parsed.success) {
    throw new EnvValidationError(flattenZodIssues(parsed.error));
  }

  const value = parsed.data;

  // Cross-field guard: DEV_AUTH_BYPASS is forbidden in PROD (security).
  if (value.APP_ENV === 'PROD' && value.DEV_AUTH_BYPASS) {
    throw new EnvValidationError([
      'DEV_AUTH_BYPASS must NOT be enabled when APP_ENV=PROD',
    ]);
  }

  const env: Env = Object.freeze({
    ...value,
    DATA_DIR: resolveDataDir(raw, appEnv),
    isProd: value.APP_ENV === 'PROD',
    isTest: value.APP_ENV === 'TEST',
    isDev: value.APP_ENV === 'DEV',
  });

  cached = env;
  return env;
}

function flattenZodIssues(error: z.ZodError): string[] {
  return error.issues.map((issue) => {
    const path = issue.path.join('.') || '(root)';
    return `${path}: ${issue.message}`;
  });
}

/** Reset the module-level cache (tests only). */
export function resetEnvCache(): void {
  cached = undefined;
}
