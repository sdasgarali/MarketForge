import type { TenantContext } from './context.js';

/**
 * Minimal, framework-agnostic request abstraction. Just enough surface to read
 * the Authorization header and the active-org hint. The API app adapts its
 * concrete request (Express/Fastify/Next) to this shape — this package never
 * depends on a web framework.
 */
export interface AuthRequestLike {
  headers: Record<string, string | string[] | undefined>;
}

/**
 * The thin auth boundary. Everything behind Clerk lives here so an alternate
 * IdP (e.g. Better Auth, per ADR-002) can be dropped in by implementing
 * `resolve` — no downstream code changes.
 */
export interface AuthProvider {
  /** Resolve the tenant context for a request, or throw an auth error. */
  resolve(req: AuthRequestLike): Promise<TenantContext>;
}

/** Normalize a possibly-array header value to a single string. */
function headerValue(
  headers: AuthRequestLike['headers'],
  name: string,
): string | undefined {
  // Header lookups are case-insensitive per HTTP; normalize to lowercase.
  const target = name.toLowerCase();
  for (const key of Object.keys(headers)) {
    if (key.toLowerCase() === target) {
      const value = headers[key];
      if (Array.isArray(value)) return value[0];
      return value;
    }
  }
  return undefined;
}

/** Extract a bearer token from `Authorization: Bearer <jwt>`. */
export function extractBearerToken(req: AuthRequestLike): string | undefined {
  const auth = headerValue(req.headers, 'authorization');
  if (!auth) return undefined;
  const match = /^Bearer\s+(.+)$/i.exec(auth.trim());
  return match?.[1]?.trim() || undefined;
}

/**
 * Extract the active-org hint from the `x-org-id` header. The API forwards the
 * caller's currently-selected Clerk active org here so the provider can pin the
 * tenant even when the token carries multiple memberships.
 */
export function extractActiveOrg(req: AuthRequestLike): string | undefined {
  const value = headerValue(req.headers, 'x-org-id');
  return value?.trim() || undefined;
}
