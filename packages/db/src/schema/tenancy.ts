import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, pk, updatedAt } from './_shared.js';

/**
 * Tenancy + identity tables.
 *
 * `organizations` IS the tenant — it has NO org_id and is NOT RLS-scoped.
 * `users` is a GLOBAL identity — also no org_id (a user may belong to many orgs).
 * `org_memberships` is the join table and the first tenant-scoped table.
 */

export const organizations = pgTable(
  'organizations',
  {
    id: pk(),
    name: text('name').notNull(),
    slug: text('slug').notNull(),
    plan: text('plan').notNull().default('free'),
    clerkOrgId: text('clerk_org_id'),
    status: text('status').notNull().default('active'),
    settings: jsonb('settings'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('organizations_slug_uidx').on(t.slug),
    uniqueIndex('organizations_clerk_org_id_uidx').on(t.clerkOrgId),
  ],
);

export const users = pgTable(
  'users',
  {
    id: pk(),
    clerkUserId: text('clerk_user_id'),
    email: text('email').notNull(),
    fullName: text('full_name'),
    avatarUrl: text('avatar_url'),
    lastLoginAt: timestamp('last_login_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex('users_email_uidx').on(t.email),
    uniqueIndex('users_clerk_user_id_uidx').on(t.clerkUserId),
  ],
);

export const orgMemberships = pgTable(
  'org_memberships',
  {
    id: pk(),
    orgId: uuid('org_id')
      .notNull()
      .references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id')
      .notNull()
      .references(() => users.id, { onDelete: 'cascade' }),
    role: text('role').notNull(),
    invitedBy: uuid('invited_by'),
    status: text('status').notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      'org_memberships_role_chk',
      sql`${t.role} IN ('admin','manager','editor','viewer')`,
    ),
    uniqueIndex('org_memberships_org_user_uidx').on(t.orgId, t.userId),
    index('org_memberships_org_id_idx').on(t.orgId),
    index('org_memberships_user_id_idx').on(t.userId),
  ],
);
