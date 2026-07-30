import { readFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { drizzle } from 'drizzle-orm/postgres-js';
import { migrate } from 'drizzle-orm/postgres-js/migrator';
import postgres from 'postgres';

/**
 * Programmatic migrator (ADR-001).
 *
 * Connects as the ADMIN/OWNER role (DEV_DATABASE_ADMIN_URL, falling back to
 * DATABASE_URL for single-role local setups) — the role that owns the tables
 * and is allowed to CREATE POLICY. It:
 *   1. runs drizzle-kit's generated migrations from ./drizzle, then
 *   2. applies the hand-written RLS SQL (src/rls.sql) which ENABLE/FORCE RLS and
 *      (re)creates the tenant_isolation policy on every tenant table.
 *
 * Run with: `pnpm --filter @marketforge/db db:migrate`.
 */

const here = dirname(fileURLToPath(import.meta.url));

async function main(): Promise<void> {
  const url = process.env.DEV_DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      'migrate: set DEV_DATABASE_ADMIN_URL or DATABASE_URL (admin/owner role that can CREATE POLICY)',
    );
  }

  // `max: 1` keeps the migration lock/session predictable.
  const sql = postgres(url, { max: 1, onnotice: () => undefined });
  const db = drizzle(sql);

  try {
    // 1) Drizzle-generated schema migrations. Resolve relative to package root
    //    so it works regardless of CWD (tsx runs from ./src; dist from ./dist).
    const migrationsFolder = resolve(here, '..', 'drizzle');
    console.log(`[migrate] applying migrations from ${migrationsFolder}`);
    await migrate(db, { migrationsFolder });
    console.log('[migrate] drizzle migrations complete');

    // 2) RLS: enable/force + policy. Idempotent.
    const rlsPath = resolve(here, 'rls.sql');
    console.log(`[migrate] applying RLS from ${rlsPath}`);
    const rlsSql = await readFile(rlsPath, 'utf8');
    await sql.unsafe(rlsSql);
    console.log('[migrate] RLS applied (ENABLE + FORCE + tenant_isolation policy)');
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main()
  .then(() => {
    console.log('[migrate] done');
    process.exit(0);
  })
  .catch((err: unknown) => {
    console.error('[migrate] failed:', err);
    process.exit(1);
  });
