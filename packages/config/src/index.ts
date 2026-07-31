/**
 * @marketforge/config — single, Zod-validated, APP_ENV-prefixed env loader.
 *
 * Usage:
 *   import { env } from '@marketforge/config';
 *   env.DATABASE_URL;   // typed, validated, fail-fast at import
 *
 * For tests or lazy loading, call `loadEnv({ reload: true, source })`.
 */
export {
  loadEnv,
  loadRootEnv,
  resetEnvCache,
  EnvValidationError,
  type LoadEnvOptions,
} from './loader.js';
export {
  envSchema,
  APP_ENVS,
  CANONICAL_ENV_KEYS,
  type Env,
  type AppEnv,
} from './schema.js';
export { dataPath, isWindows } from './paths.js';

import { loadEnv } from './loader.js';
import type { Env } from './schema.js';

/**
 * Eagerly-loaded, cached, frozen env singleton. Importing this validates the
 * environment immediately (fail-fast). If you need to defer validation (e.g. a
 * CLI that sets env at runtime), import `loadEnv` instead of `env`.
 */
export const env: Env = loadEnv();
