import { OrgRole } from '@marketforge/contracts';
import type { OrgRole as OrgRoleType } from '@marketforge/contracts';
import { jwtVerify } from 'jose';
import type { TenantContext } from './context.js';
import { UnauthorizedError } from './errors.js';
import type { AuthProvider, AuthRequestLike } from './provider.js';
import { extractActiveOrg, extractBearerToken } from './provider.js';

/**
 * Claims carried by a MarketForge-issued JWT (see apps/api jwt-sign). The token
 * is self-contained: it pins the tenant (`org_id`) and role, so no IdP lookup
 * is needed on verify.
 */
export interface MarketForgeJwtClaims {
  sub: string;
  email?: string;
  name?: string;
  org_id?: string;
  role?: string;
}

function mapRole(raw: string | undefined): OrgRoleType {
  if (!raw) return 'viewer';
  const parsed = OrgRole.safeParse(raw);
  return parsed.success ? parsed.data : 'viewer';
}

/**
 * Manual JWT auth provider (replaces Clerk). Verifies an HS256 token signed with
 * `AUTH_JWT_SECRET` and maps its claims to a TenantContext. The token's `org_id`
 * is the tenant; an `x-org-id` header may override it (multi-org users), but the
 * default single-pilot-org model just uses the embedded org.
 */
export class JwtAuthProvider implements AuthProvider {
  private readonly key: Uint8Array;

  constructor(secret: string) {
    this.key = new TextEncoder().encode(secret);
  }

  async resolve(req: AuthRequestLike): Promise<TenantContext> {
    const token = extractBearerToken(req);
    if (!token) {
      throw new UnauthorizedError('Missing bearer token');
    }

    let claims: MarketForgeJwtClaims;
    try {
      const { payload } = await jwtVerify(token, this.key);
      claims = payload as unknown as MarketForgeJwtClaims;
    } catch (cause) {
      throw new UnauthorizedError(
        `Invalid or expired token: ${cause instanceof Error ? cause.message : 'verification failed'}`,
      );
    }

    const orgId = extractActiveOrg(req) ?? claims.org_id;
    if (!orgId) {
      throw new UnauthorizedError('Token is missing an organization');
    }

    return {
      orgId,
      user: {
        id: claims.sub,
        email: claims.email ?? '',
        ...(claims.name ? { fullName: claims.name } : {}),
      },
      role: mapRole(claims.role),
      isBypass: false,
    };
  }
}
