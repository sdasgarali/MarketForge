import { defineConfig } from 'drizzle-kit';

/**
 * Drizzle Kit config.
 *
 * Migrations run as the ADMIN/OWNER role that can create RLS policies and OWN
 * the tables — NOT the app role (ADR-001: the app connects as a NON-BYPASSRLS
 * role). Point this at the admin connection string; fall back to DATABASE_URL
 * for single-role local setups.
 */
const url = process.env.DEV_DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;

if (!url) {
  throw new Error(
    'drizzle.config: set DEV_DATABASE_ADMIN_URL or DATABASE_URL for migrations',
  );
}

export default defineConfig({
  // Point at the COMPILED schema (real .js) — drizzle-kit's bundler can't follow
  // NodeNext '.js' import specifiers back to their '.ts' sources. Build the package
  // before `db:generate`. Tables are re-exported from the built index.
  dialect: 'postgresql',
  schema: './dist/index.js',
  out: './drizzle',
  dbCredentials: { url },
  strict: true,
  verbose: true,
});
