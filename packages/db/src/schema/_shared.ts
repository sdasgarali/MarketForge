import { sql } from 'drizzle-orm';
import { timestamp, uuid } from 'drizzle-orm/pg-core';

/**
 * Shared column builders. Kept as factory functions so each table gets its own
 * column instances (Drizzle column objects are stateful and must not be reused
 * across tables).
 */

/** Primary key: uuid, DB-generated via pgcrypto's gen_random_uuid(). */
export const pk = () =>
  uuid('id').primaryKey().default(sql`gen_random_uuid()`);

/** `created_at timestamptz not null default now()`. */
export const createdAt = () =>
  timestamp('created_at', { withTimezone: true }).notNull().defaultNow();

/** `updated_at timestamptz not null default now()` — bump in app/service layer. */
export const updatedAt = () =>
  timestamp('updated_at', { withTimezone: true }).notNull().defaultNow();

/**
 * `org_id uuid not null` — the tenant discriminator present on EVERY
 * tenant-scoped table (ADR-001). RLS policies key off this column.
 */
export const orgId = () => uuid('org_id').notNull();
