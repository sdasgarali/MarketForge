import { env } from '@marketforge/config';
import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/postgres-js';
import type { PostgresJsDatabase } from 'drizzle-orm/postgres-js';
import postgres from 'postgres';
import type { Sql } from 'postgres';
import * as schema from './schema/index.js';

/**
 * Tenant-scoped Drizzle client (ADR-001).
 *
 * The application MUST connect as a NON-BYPASSRLS role. All access to tenant
 * tables goes through {@link withTenant}, which opens a transaction and sets
 * `app.current_org` for the life of that transaction (SET LOCAL). RLS policies
 * then filter every row by
 * `org_id = current_setting('app.current_org')::uuid`.
 */

/** The Postgres GUC that RLS policies read. Must match `src/rls.sql`. */
export const TENANT_SETTING = 'app.current_org';

export type Schema = typeof schema;
export type Database = PostgresJsDatabase<Schema>;
/** The transaction handle passed to the {@link withTenant} callback. */
export type TenantTx = Parameters<Parameters<Database['transaction']>[0]>[0];

export interface Db {
  db: Database;
  sql: Sql;
}

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, label: string): void {
  if (!UUID_RE.test(value)) {
    throw new Error(
      `${label} must be a valid UUID, got: ${JSON.stringify(value)}`,
    );
  }
}

/**
 * Create a Drizzle client + underlying postgres.js connection.
 *
 * @param connectionString Postgres URL. Defaults to the validated
 *   `env.DATABASE_URL` (the app / non-bypassrls role).
 */
export function createDb(connectionString: string = env.DATABASE_URL): Db {
  const client = postgres(connectionString, { max: 10 });
  const db = drizzle(client, { schema });
  return { db, sql: client };
}

/**
 * Run `cb` inside a transaction scoped to a single tenant.
 *
 * Sets `app.current_org` via `set_config(name, value, is_local => true)` as a
 * PARAMETERIZED query (no string interpolation → no SQL injection), after
 * validating `orgId` is a UUID. This is the ONLY sanctioned way to touch tenant
 * tables (ADR-001): outside a `withTenant` transaction, RLS sees no
 * `app.current_org` and every tenant row is invisible.
 *
 * @typeParam T The callback's return type.
 * @param db     A Drizzle database (from {@link createDb} or the default `db`).
 * @param orgId  Tenant UUID; validated before use.
 * @param cb     Receives the transaction handle; do all tenant work through it.
 */
export async function withTenant<T>(
  db: Database,
  orgId: string,
  cb: (tx: TenantTx) => Promise<T>,
): Promise<T> {
  assertUuid(orgId, 'orgId');
  return db.transaction(async (tx) => {
    // `set_config(..., true)` = transaction-local; parameterized to prevent
    // injection.
    await tx.execute(sql`SELECT set_config(${TENANT_SETTING}, ${orgId}, true)`);
    return cb(tx);
  });
}

// --- Lazily-created default singleton -------------------------------------

let _default: Db | undefined;

function defaultDb(): Db {
  _default ??= createDb();
  return _default;
}

/**
 * Lazily-created default client bound to `env.DATABASE_URL`. Use with
 * {@link withTenant}: `withTenant(db, orgId, async (tx) => { ... })`.
 */
export const db: Database = new Proxy({} as Database, {
  get(_target, prop, receiver) {
    return Reflect.get(defaultDb().db, prop, receiver) as unknown;
  },
}) as Database;
