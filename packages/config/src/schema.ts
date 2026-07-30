import { z } from 'zod';

/**
 * Canonical (pre-prefix) environment schema for MarketForge.
 *
 * Every key here is a CANONICAL name. The loader resolves each canonical key
 * `X` from the raw process env by trying `${APP_ENV}_X` first, then bare `X`
 * (see resolveCanonicalEnv). OS-specific paths are resolved separately.
 */

export const APP_ENVS = ['TEST', 'DEV', 'PROD'] as const;
export type AppEnv = (typeof APP_ENVS)[number];

const booleanish = z
  .union([z.boolean(), z.string()])
  .transform((v) => (typeof v === 'boolean' ? v : ['1', 'true', 'yes', 'on'].includes(v.toLowerCase())));

const optionalString = z.string().min(1).optional();

/**
 * The validated shape. Required keys fail fast when missing; optional keys are
 * left undefined so downstream adapters can decide whether they are needed.
 */
export const envSchema = z.object({
  // Runtime selector
  APP_ENV: z.enum(APP_ENVS),
  NODE_ENV: z.string().default('development'),

  // --- Core infra (required) ---
  DATABASE_URL: z.string().url(),
  DATABASE_ADMIN_URL: z.string().url().optional(),
  REDIS_URL: z.string().url(),

  // --- Auth (Clerk) ---
  CLERK_SECRET_KEY: optionalString,
  CLERK_PUBLISHABLE_KEY: optionalString,
  CLERK_JWT_KEY: optionalString,
  CLERK_WEBHOOK_SECRET: optionalString,
  DEV_AUTH_BYPASS: booleanish.default(false),

  // --- Secrets / envelope encryption (required for secrets pkg) ---
  ENCRYPTION_MASTER_KEY: z
    .string()
    .min(1, 'ENCRYPTION_MASTER_KEY is required (base64-encoded 32 bytes)'),
  ENCRYPTION_KEK_ID: z.string().default('local-dev-kek-v1'),
  API_KEY_HASH_PEPPER: z.string().min(1, 'API_KEY_HASH_PEPPER is required'),

  // --- AI providers (optional; adapters fail at call-time if absent) ---
  ANTHROPIC_API_KEY: optionalString,
  OPENAI_API_KEY: optionalString,
  GEMINI_API_KEY: optionalString,
  GROQ_API_KEY: optionalString,
  OPENROUTER_API_KEY: optionalString,
  FAL_API_KEY: optionalString,
  ELEVENLABS_API_KEY: optionalString,

  // --- Publishing (Ayrshare) ---
  AYRSHARE_API_KEY: optionalString,
  AYRSHARE_DOMAIN: optionalString,

  // --- Storage (S3 primary + Drive mirror) ---
  S3_ENDPOINT: optionalString,
  S3_REGION: z.string().default('us-east-1'),
  S3_BUCKET: optionalString,
  S3_ACCESS_KEY_ID: optionalString,
  S3_SECRET_ACCESS_KEY: optionalString,
  S3_FORCE_PATH_STYLE: booleanish.default(true),
  GOOGLE_DRIVE_CLIENT_EMAIL: optionalString,
  GOOGLE_DRIVE_PRIVATE_KEY: optionalString,
  GOOGLE_DRIVE_ROOT_FOLDER_ID: optionalString,

  // --- n8n ---
  N8N_WEBHOOK_BASE_URL: z.string().url().default('http://localhost:5678/webhook'),
  N8N_WEBHOOK_SECRET: optionalString,

  // --- Notifications ---
  SLACK_WEBHOOK_URL: optionalString,
  DISCORD_WEBHOOK_URL: optionalString,
  TELEGRAM_BOT_TOKEN: optionalString,
  SMTP_URL: optionalString,

  // --- Observability ---
  SENTRY_DSN: optionalString,
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .default('info'),
  LOG_PRETTY: booleanish.default(false),

  // --- App ports/urls ---
  API_PORT: z.coerce.number().int().positive().default(8080),
  API_BASE_URL: z.string().url().default('http://localhost:8080'),
  WEB_PORT: z.coerce.number().int().positive().default(3000),
  WEB_BASE_URL: z.string().url().default('http://localhost:3000'),
});

export type Env = z.infer<typeof envSchema> & {
  /** OS-resolved data directory (from *_DATA_DIR_WIN / *_DATA_DIR_LINUX). */
  DATA_DIR: string;
  /** Convenience flags. */
  isProd: boolean;
  isTest: boolean;
  isDev: boolean;
};

/** Canonical env var names (pre-prefix) — exported for tooling/docs. */
export const CANONICAL_ENV_KEYS = Object.keys(envSchema.shape) as (keyof z.infer<
  typeof envSchema
>)[];
