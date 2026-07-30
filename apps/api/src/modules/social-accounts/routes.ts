/**
 * Social-accounts routes, nested under a brand: /brands/:brandId/social-accounts.
 * Editor+ to read/write (they carry connection state + reference secrets).
 * `mergeParams` so :brandId from the parent brands router is visible here.
 */
import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { getCtx } from '../../lib/context.js';
import { parseOrThrow } from '../../lib/validate.js';
import { writeAudit } from '../../lib/audit.js';
import { requireMinRole } from '../../middleware/rbac.js';
import { SocialAccountInput, socialAccountsService } from './service.js';

export const socialAccountsRouter: Router = Router({ mergeParams: true });

socialAccountsRouter.get(
  '/',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    res.json(await socialAccountsService.list(ctx.orgId, req.params.brandId!));
  }),
);

socialAccountsRouter.post(
  '/',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const input = parseOrThrow(SocialAccountInput, req.body);
    const account = await socialAccountsService.create(ctx.orgId, req.params.brandId!, input);
    await writeAudit(
      ctx,
      { action: 'social_account.create', entityType: 'social_account', entityId: account.id, after: account },
      req,
    );
    res.status(201).json(account);
  }),
);

socialAccountsRouter.delete(
  '/:id',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const result = await socialAccountsService.remove(ctx.orgId, req.params.brandId!, req.params.id!);
    await writeAudit(
      ctx,
      { action: 'social_account.delete', entityType: 'social_account', entityId: result.id },
      req,
    );
    res.status(204).end();
  }),
);
