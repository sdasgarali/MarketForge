import { OrgRole } from '@marketforge/contracts';
import type { OrgRole as OrgRoleType } from '@marketforge/contracts';
import type { AuthProvider, AuthRequestLike } from './provider.js';
import { extractBearerToken, extractActiveOrg } from './provider.js';
import type { TenantContext, AuthenticatedUser } from './context.js';
import { UnauthorizedError, ForbiddenError } from './errors.js';

/**
 * Shape of the Clerk session-token claims we consume. Clerk places org context
 * either in a flat `org_id`/`org_role`/`org_slug` set or under an `o` object
 * (newer token shape). We tolerate both; extra keys are ignored.
 */
export interface ClerkClaims {
  sub: string;
  email?: string;
  name?: string;
  org_id?: string;
  org_role?: string;
  org_slug?: string;
  /** Newer compact org claim: { id, rol, slg }. */
  o?: { id?: string; rol?: string; slg?: string };
  [k: string]: unknown;
}

/** Options for the Clerk verifier. */
export interface ClerkAuthProviderOptions {
  secretKey: string;
  jwtKey?: string;
}

/**
 * Map a Clerk `org_role` claim (e.g. `org:admin`) to our `OrgRole`. Strips the
 * `org:` prefix and validates against the contract enum; unknown roles fall
 * back to the least-privileged `viewer` (fail safe, not fail open).
 */
function mapClerkRole(raw: string | undefined): OrgRoleType {
  if (!raw) return 'viewer';
  const stripped = raw.startsWith('org:') ? raw.slice('org:'.length) : raw;
  const parsed = OrgRole.safeParse(stripped);
  return parsed.success ? parsed.data : 'viewer';
}

/**
 * Pure claim → TenantContext mapper. Kept side-effect free so it can be
 * reasoned about / unit-tested in isolation. `orgOverride` (the `x-org-id`
 * header) wins over the token's embedded org id when present.
 *
 * Throws ForbiddenError when no active organization can be resolved.
 */
export function mapClerkClaims(
  claims: ClerkClaims,
  orgOverride?: string,
): TenantContext {
  const clerkOrgId = orgOverride ?? claims.org_id ?? claims.o?.id;
  if (!clerkOrgId) {
    throw new ForbiddenError('No active organization');
  }

  const role = mapClerkRole(claims.org_role ?? claims.o?.rol);

  const user: AuthenticatedUser = {
    id: claims.sub,
    clerkUserId: claims.sub,
    email: claims.email ?? '',
    ...(claims.name ? { fullName: claims.name } : {}),
  };

  return {
    // Clerk org id is the tenant key mirrored into Postgres as org_id.
    orgId: clerkOrgId,
    clerkOrgId,
    user,
    role,
    isBypass: false,
  };
}

/**
 * Real Clerk-backed provider (ADR-002).
 *
 * NOTE: `@clerk/backend` is intentionally NOT a hard dependency of this package
 * (keeps install lean and avoids version guesswork). The API app that enables
 * real Clerk must `pnpm add @clerk/backend`. This provider loads it via a lazy
 * dynamic import so `@marketforge/auth` compiles and runs (in bypass mode)
 * without Clerk present — the failure only surfaces when `resolve` is called.
 */
export class ClerkAuthProvider implements AuthProvider {
  private readonly secretKey: string;
  private readonly jwtKey: string | undefined;

  constructor(options: ClerkAuthProviderOptions) {
    this.secretKey = options.secretKey;
    this.jwtKey = options.jwtKey;
  }

  async resolve(req: AuthRequestLike): Promise<TenantContext> {
    const token = extractBearerToken(req);
    if (!token) {
      throw new UnauthorizedError('Missing bearer token');
    }

    let verifyToken: (
      token: string,
      options: { secretKey: string; jwtKey?: string },
    ) => Promise<unknown>;

    try {
      // Lazy dynamic import — only loaded when real Clerk auth is exercised.
      // The specifier is computed so TypeScript does not statically require
      // `@clerk/backend` to be installed at build time (the API app installs it
      // when real Clerk auth is enabled; bypass mode never reaches this path).
      const clerkModuleName = '@clerk/backend';
      const clerkModule = (await import(/* @vite-ignore */ clerkModuleName)) as {
        verifyToken: typeof verifyToken;
      };
      ({ verifyToken } = clerkModule);
    } catch {
      throw new UnauthorizedError(
        'Clerk is not installed; enable DEV_AUTH_BYPASS or install @clerk/backend',
      );
    }

    let claims: ClerkClaims;
    try {
      const verifyOptions: { secretKey: string; jwtKey?: string } = {
        secretKey: this.secretKey,
      };
      if (this.jwtKey) verifyOptions.jwtKey = this.jwtKey;
      claims = (await verifyToken(token, verifyOptions)) as ClerkClaims;
    } catch (cause) {
      throw new UnauthorizedError(
        `Invalid or expired token: ${cause instanceof Error ? cause.message : 'verification failed'}`,
      );
    }

    return mapClerkClaims(claims, extractActiveOrg(req));
  }
}
