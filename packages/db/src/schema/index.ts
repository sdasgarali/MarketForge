/**
 * Aggregated Drizzle schema. `drizzle(sql, { schema })` and `drizzle-kit` both
 * consume this barrel. Every tenant table (those with an `org_id` column) is
 * RLS-protected — see `src/rls.sql`.
 */
export * from './tenancy.js';
export * from './brands.js';
export * from './content.js';
export * from './ops.js';
