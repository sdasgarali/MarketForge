/**
 * @marketforge/auth — Clerk-based auth behind a thin interface (ADR-002).
 *
 *   import { authProvider, requireRole } from '@marketforge/auth';
 *   const ctx = await authProvider.resolve(req); // TenantContext
 *   requireRole('manager', ctx);
 *   // ...then: SET LOCAL app.current_org = ctx.orgId  (ADR-001)
 *
 * Selection is env-driven (see createAuthProvider). Clerk calls live behind the
 * AuthProvider interface so an alternate IdP can replace it later.
 */
import { env } from '@marketforge/config';
import type { AuthProvider } from './provider.js';
import { BypassAuthProvider } from './bypass.js';
import { ClerkAuthProvider } from './clerk.js';
import { JwtAuthProvider } from './jwt.js';

/**
 * Build the active auth provider from config:
 *   1. DEV_AUTH_BYPASS on   → BypassAuthProvider (config already forbids +PROD).
 *   2. AUTH_JWT_SECRET set   → JwtAuthProvider (manual email/password + JWT).
 *   3. CLERK_SECRET_KEY set  → ClerkAuthProvider (legacy).
 *   4. else → throw (misconfiguration; fail fast).
 */
export function createAuthProvider(): AuthProvider {
  if (env.DEV_AUTH_BYPASS) {
    return new BypassAuthProvider();
  }
  if (env.AUTH_JWT_SECRET) {
    return new JwtAuthProvider(env.AUTH_JWT_SECRET);
  }
  if (env.CLERK_SECRET_KEY) {
    const options: { secretKey: string; jwtKey?: string } = {
      secretKey: env.CLERK_SECRET_KEY,
    };
    if (env.CLERK_JWT_KEY) options.jwtKey = env.CLERK_JWT_KEY;
    return new ClerkAuthProvider(options);
  }
  throw new Error(
    'No auth configured: set AUTH_JWT_SECRET, CLERK_SECRET_KEY, or DEV_AUTH_BYPASS',
  );
}

let _authProvider: AuthProvider | undefined;

/**
 * Lazy singleton — the provider is created on first access, so importing this
 * module doesn't force auth config resolution at import time.
 */
export const authProvider: AuthProvider = {
  resolve(req) {
    _authProvider ??= createAuthProvider();
    return _authProvider.resolve(req);
  },
};

// --- Public surface -------------------------------------------------------
export type {
  TenantContext,
  AuthenticatedUser,
} from './context.js';
export type { AuthProvider, AuthRequestLike } from './provider.js';
export { extractBearerToken, extractActiveOrg } from './provider.js';
export { requireRole, requireAnyRole, hasRole } from './rbac.js';
export { UnauthorizedError, ForbiddenError } from './errors.js';
export { BypassAuthProvider } from './bypass.js';
export { ClerkAuthProvider, mapClerkClaims } from './clerk.js';
export type { ClerkClaims, ClerkAuthProviderOptions } from './clerk.js';
export { JwtAuthProvider } from './jwt.js';
export type { MarketForgeJwtClaims } from './jwt.js';
