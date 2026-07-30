import type { OrgRole } from '@marketforge/contracts';

/**
 * The authenticated principal. `id` is the MarketForge (Postgres) user id;
 * `clerkUserId` is the upstream IdP subject (present when Clerk resolved it,
 * absent in bypass mode). Kept minimal and PII-light on purpose.
 */
export interface AuthenticatedUser {
  /** MarketForge user id (mirrored from Clerk into Postgres). */
  id: string;
  /** Upstream Clerk `sub` (undefined in bypass mode). */
  clerkUserId?: string;
  email: string;
  fullName?: string;
}

/**
 * The resolved per-request tenant context (ADR-001 + ADR-002).
 *
 * Downstream code uses `orgId` to scope the tenant, e.g. the API runs
 * `SET LOCAL app.current_org = ctx.orgId` before touching RLS-guarded tables.
 * `role` drives RBAC guards (see `requireRole`). `isBypass` is true only when
 * the fake dev-admin context was injected (never in PROD).
 */
export interface TenantContext {
  /** Active MarketForge org id — used for `SET LOCAL app.current_org`. */
  orgId: string;
  /** Upstream Clerk org id (undefined in bypass mode). */
  clerkOrgId?: string;
  user: AuthenticatedUser;
  role: OrgRole;
  /** True when this context was produced by DEV_AUTH_BYPASS. */
  isBypass: boolean;
}
