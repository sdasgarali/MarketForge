/**
 * Tenant provisioning for signups. Each new user gets a DEDICATED organization
 * + a global user identity + an admin membership — the foundation of real
 * multi-tenancy (every org is isolated by Postgres RLS via `org_id`).
 *
 * `organizations` and `users` are global (no RLS); `org_memberships` is
 * tenant-scoped, so it's inserted under the new org's RLS context.
 */
import { randomBytes } from 'node:crypto';
import { eq } from 'drizzle-orm';
import { db, orgMemberships, organizations, users, withTenant } from '@marketforge/db';

export interface ProvisionedTenant {
  orgId: string;
  userId: string;
  orgName: string;
}

function slugify(base: string): string {
  const s = base
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return s || 'org';
}

export async function provisionTenant(input: {
  email: string;
  name?: string;
}): Promise<ProvisionedTenant> {
  const email = input.email.toLowerCase();
  const displayName = input.name?.trim() || email.split('@')[0] || 'New';
  const orgName = `${displayName}'s workspace`;
  const slug = `${slugify(displayName)}-${randomBytes(3).toString('hex')}`;

  // 1) Organization (global table — the tenant itself).
  const [org] = await db
    .insert(organizations)
    .values({ name: orgName, slug })
    .returning({ id: organizations.id });
  const orgId = org!.id;

  // 2) Global user identity (reuse if the email already exists in Postgres).
  const [existing] = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.email, email))
    .limit(1);
  let userId: string;
  if (existing) {
    userId = existing.id;
  } else {
    const [u] = await db
      .insert(users)
      .values({ email, fullName: input.name ?? null })
      .returning({ id: users.id });
    userId = u!.id;
  }

  // 3) Admin membership (RLS-scoped → inserted under the new org).
  await withTenant(db, orgId, async (tx) => {
    await tx.insert(orgMemberships).values({ orgId, userId, role: 'admin' });
  });

  return { orgId, userId, orgName };
}
