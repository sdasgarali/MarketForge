/**
 * authContext middleware — resolves the per-request TenantContext via the
 * @marketforge/auth provider (Clerk in prod, DEV_AUTH_BYPASS in dev) and attaches
 * it as `req.ctx`. On any auth failure it forwards a 401/403 to the error handler.
 *
 * Downstream handlers read `req.ctx` (via getCtx) and MUST scope every tenant DB
 * access with `withTenant(db, ctx.orgId, ...)`.
 */
import type { RequestHandler } from 'express';
import { authProvider } from '@marketforge/auth';
import { asyncHandler } from '../lib/async-handler.js';

export const authContext: RequestHandler = asyncHandler(async (req, _res, next) => {
  // authProvider.resolve reads headers (Authorization + x-org-id) and throws
  // Unauthorized/Forbidden on failure — those map to 401/403 in the handler.
  const ctx = await authProvider.resolve({ headers: req.headers });
  req.ctx = ctx;
  next();
});
