import { ORG_ROLE_RANK } from '@marketforge/contracts';
import type { OrgRole } from '@marketforge/contracts';
import type { TenantContext } from './context.js';
import { ForbiddenError } from './errors.js';

/**
 * Role precedence check: does the context's role meet or exceed `minimum`?
 * Ranking comes from the contract (viewer < editor < manager < admin).
 */
export function hasRole(ctx: TenantContext, minimum: OrgRole): boolean {
  return ORG_ROLE_RANK[ctx.role] >= ORG_ROLE_RANK[minimum];
}

/**
 * Guard: throw ForbiddenError unless `ctx.role` ranks at or above `minimum`.
 * Use at the top of protected handlers/services.
 */
export function requireRole(minimum: OrgRole, ctx: TenantContext): void {
  if (!hasRole(ctx, minimum)) {
    throw new ForbiddenError(
      `Requires role '${minimum}' or higher; current role is '${ctx.role}'`,
    );
  }
}

/**
 * Guard: throw ForbiddenError unless `ctx.role` is one of `roles` (exact match,
 * not a rank threshold). Useful for allow-lists that aren't strictly ordered.
 */
export function requireAnyRole(roles: OrgRole[], ctx: TenantContext): void {
  if (!roles.includes(ctx.role)) {
    throw new ForbiddenError(
      `Requires one of roles [${roles.join(', ')}]; current role is '${ctx.role}'`,
    );
  }
}
