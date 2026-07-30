/**
 * Admin API-key management. Admin-only. POST returns the raw key once.
 */
import { Router } from 'express';
import { Uuid } from '@marketforge/contracts';
import { asyncHandler } from '../../lib/async-handler.js';
import { getCtx } from '../../lib/context.js';
import { parseOrThrow } from '../../lib/validate.js';
import { writeAudit } from '../../lib/audit.js';
import { requireMinRole } from '../../middleware/rbac.js';
import { ApiKeyCreateInput, apiKeysService } from './service.js';

export const apiKeysRouter: Router = Router();

apiKeysRouter.get(
  '/',
  requireMinRole('admin'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    res.json({ items: await apiKeysService.list(ctx.orgId) });
  }),
);

apiKeysRouter.post(
  '/',
  requireMinRole('admin'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const input = parseOrThrow(ApiKeyCreateInput, req.body);
    const result = await apiKeysService.create(ctx.orgId, input);
    await writeAudit(
      ctx,
      { action: 'api_key.create', entityType: 'api_key', entityId: result.id, after: { prefix: result.prefix } },
      req,
    );
    res.status(201).json(result);
  }),
);

apiKeysRouter.delete(
  '/:id',
  requireMinRole('admin'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const id = parseOrThrow(Uuid, req.params.id);
    const result = await apiKeysService.revoke(ctx.orgId, id);
    await writeAudit(ctx, { action: 'api_key.revoke', entityType: 'api_key', entityId: id }, req);
    res.status(200).json(result);
  }),
);
