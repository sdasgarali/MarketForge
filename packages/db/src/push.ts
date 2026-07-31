/**
 * Direct schema push (dev/local convenience).
 *
 * `drizzle-kit generate` (its CLI bundler) cannot follow our NodeNext `.js`
 * import specifiers back to their `.ts` sources when the schema is split across
 * files. This script instead loads the live schema through tsx (which resolves
 * `.js`→`.ts`) and uses drizzle-kit's programmatic `pushSchema` to apply the DDL
 * straight to the database, then applies `rls.sql`.
 *
 * Runs as the ADMIN/OWNER role (DEV_DATABASE_ADMIN_URL → DATABASE_URL fallback).
 * For real migration history use `db:generate` + `db:migrate` once the schema is
 * consolidated; `push` is for fast local bring-up.
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { loadRootEnv } from '@marketforge/config';
import postgres from 'postgres';
import * as schema from './schema/index.js';

// Load the repo-root .env before reading connection strings (see migrate.ts).
loadRootEnv();

// drizzle-kit/api.mjs (ESM) ships broken dynamic requires; the CJS build works.
// Force the CJS variant via createRequire.
const require = createRequire(import.meta.url);
// eslint-disable-next-line @typescript-eslint/no-var-requires
const { generateDrizzleJson, generateMigration } = require(
  'drizzle-kit/api',
) as typeof import('drizzle-kit/api');

async function main(): Promise<void> {
  const url = process.env.DEV_DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error('push: set DEV_DATABASE_ADMIN_URL or DATABASE_URL');
  }

  const client = postgres(url, { max: 1 });

  try {
    // Pure schema→SQL (no DB introspection): diff an EMPTY snapshot against the
    // live schema to get the full CREATE DDL.
    const empty = generateDrizzleJson({});
    const current = generateDrizzleJson(schema as Record<string, unknown>);
    const statements = await generateMigration(empty, current);
    console.log(`[push] ${statements.length} DDL statement(s) generated`);

    await client.begin(async (tx) => {
      for (const stmt of statements) {
        await tx.unsafe(stmt);
      }
    });
    console.log('[push] schema applied');

    const rls = readFileSync(new URL('./rls.sql', import.meta.url), 'utf8');
    await client.unsafe(rls);
    console.log('[push] RLS applied (ENABLE + FORCE + tenant_isolation policy)');
    console.log('[push] done');
  } finally {
    await client.end();
  }
}

main().catch((err) => {
  console.error('[push] failed:', err);
  process.exit(1);
});
