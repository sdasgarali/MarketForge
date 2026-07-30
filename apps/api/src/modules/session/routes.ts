/**
 * Session/auth introspection. `GET /me` returns the resolved tenant context so
 * the frontend knows the active org, role, and user identity.
 */
import { Router } from 'express';
import { getCtx } from '../../lib/context.js';

export const sessionRouter: Router = Router();

sessionRouter.get('/me', (req, res) => {
  const ctx = getCtx(req);
  res.json({
    org_id: ctx.orgId,
    clerk_org_id: ctx.clerkOrgId,
    role: ctx.role,
    is_bypass: ctx.isBypass,
    user: {
      id: ctx.user.id,
      email: ctx.user.email,
      full_name: ctx.user.fullName,
    },
  });
});
