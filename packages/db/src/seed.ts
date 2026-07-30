import { eq, sql } from 'drizzle-orm';
import { createDb, withTenant } from './client.js';
import { brands } from './schema/brands.js';
import { orgMemberships, organizations, users } from './schema/tenancy.js';

/**
 * Idempotent dev seed.
 *
 * Creates: one organization (MarketForge Dev), one admin user, an admin
 * org_membership, and one brand ("Exzelon") under that org. Re-running is safe
 * (existence checks + ON CONFLICT DO NOTHING). The brand insert goes through
 * `withTenant` to honor RLS (ADR-001).
 *
 * Runs as the connection in DATABASE_URL. NOTE: if you run the seed as the
 * NON-BYPASSRLS app role, it works because `withTenant` sets `app.current_org`;
 * the org/user/membership rows are written before RLS scoping via ON CONFLICT.
 * For a fresh DB it's simplest to run the seed as the admin/owner role.
 */

const ORG_NAME = 'MarketForge Dev';
const ORG_SLUG = 'marketforge-dev';
const ADMIN_EMAIL = process.env.SEED_ADMIN_EMAIL ?? 'admin@marketforge.dev';
const BRAND_NAME = 'Exzelon';

async function main(): Promise<void> {
  const url = process.env.DEV_DATABASE_ADMIN_URL ?? process.env.DATABASE_URL;
  const { db, sql: client } = url ? createDb(url) : createDb();

  try {
    // 1) Organization (org_id-free; unique slug).
    const [org] = await db
      .insert(organizations)
      .values({ name: ORG_NAME, slug: ORG_SLUG, plan: 'pro', status: 'active' })
      .onConflictDoNothing({ target: organizations.slug })
      .returning();

    const orgRow =
      org ??
      (
        await db
          .select()
          .from(organizations)
          .where(eq(organizations.slug, ORG_SLUG))
          .limit(1)
      )[0];

    if (!orgRow) throw new Error('seed: failed to create/find organization');

    // 2) Admin user (global identity; unique email).
    const [user] = await db
      .insert(users)
      .values({ email: ADMIN_EMAIL, fullName: 'MarketForge Admin' })
      .onConflictDoNothing({ target: users.email })
      .returning();

    const userRow =
      user ??
      (
        await db
          .select()
          .from(users)
          .where(eq(users.email, ADMIN_EMAIL))
          .limit(1)
      )[0];

    if (!userRow) throw new Error('seed: failed to create/find admin user');

    // 3) Admin membership (unique(org_id, user_id)).
    await db
      .insert(orgMemberships)
      .values({
        orgId: orgRow.id,
        userId: userRow.id,
        role: 'admin',
        status: 'active',
      })
      .onConflictDoNothing();

    // 4) Brand "Exzelon" — through withTenant so RLS is exercised end-to-end.
    const brandId = await withTenant(db, orgRow.id, async (tx) => {
      const existing = await tx
        .select({ id: brands.id })
        .from(brands)
        .where(sql`${brands.orgId} = ${orgRow.id} AND ${brands.companyName} = ${BRAND_NAME}`)
        .limit(1);

      const found = existing[0];
      if (found) return found.id;

      const [inserted] = await tx
        .insert(brands)
        .values({
          orgId: orgRow.id,
          companyName: BRAND_NAME,
          industry: 'AI / SaaS',
          status: 'active',
        })
        .returning({ id: brands.id });

      if (!inserted) throw new Error('seed: failed to insert brand');
      return inserted.id;
    });

    console.log('[seed] complete:');
    console.log(`  organization: ${orgRow.name} (${orgRow.id})`);
    console.log(`  admin user:   ${userRow.email} (${userRow.id})`);
    console.log(`  membership:   admin`);
    console.log(`  brand:        ${BRAND_NAME} (${brandId})`);
  } finally {
    await client.end({ timeout: 5 });
  }
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error('[seed] failed:', err);
    process.exit(1);
  });
