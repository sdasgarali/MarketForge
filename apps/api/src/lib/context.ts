import type { Request } from 'express';
import type { TenantContext } from '@marketforge/auth';
import { UnauthorizedError } from '@marketforge/auth';

/**
 * Retrieve the resolved tenant context from a request, or throw 401 if the
 * authContext middleware did not attach one (defensive — routes behind auth
 * should always have it). Guarantees a non-undefined ctx to callers.
 */
export function getCtx(req: Request): TenantContext {
  const ctx = req.ctx;
  if (!ctx) {
    throw new UnauthorizedError('Missing tenant context');
  }
  return ctx;
}
