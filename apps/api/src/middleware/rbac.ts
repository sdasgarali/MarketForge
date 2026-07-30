/**
 * RBAC guard middleware factory. Wraps @marketforge/auth `requireRole` so routes
 * can declare a minimum role declaratively: `router.post('/', requireMinRole('editor'), ...)`.
 * Relies on authContext having attached `req.ctx` first.
 */
import type { RequestHandler } from 'express';
import { requireRole } from '@marketforge/auth';
import type { OrgRole } from '@marketforge/contracts';
import { getCtx } from '../lib/context.js';

export function requireMinRole(minimum: OrgRole): RequestHandler {
  return (req, _res, next) => {
    try {
      requireRole(minimum, getCtx(req));
      next();
    } catch (err) {
      next(err);
    }
  };
}
