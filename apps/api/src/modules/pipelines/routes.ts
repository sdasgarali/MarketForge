/**
 * Pipelines monitor + control. GET status is manager+; start/shutdown/resume are
 * admin-only (they mutate live processing). Force-shutdown is audited.
 */
import { Router } from 'express';
import { asyncHandler } from '../../lib/async-handler.js';
import { getCtx } from '../../lib/context.js';
import { requireMinRole } from '../../middleware/rbac.js';
import { writeAudit } from '../../lib/audit.js';
import { pipelinesService } from './service.js';

export const pipelinesRouter: Router = Router();

pipelinesRouter.get(
  '/',
  requireMinRole('viewer'),
  asyncHandler(async (_req, res) => {
    res.json(await pipelinesService.status());
  }),
);

pipelinesRouter.post(
  '/start',
  requireMinRole('admin'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const result = await pipelinesService.start(ctx.orgId);
    await writeAudit(ctx, { action: 'pipelines.start', entityType: 'pipeline' }, req);
    res.json(result);
  }),
);

pipelinesRouter.post(
  '/shutdown',
  requireMinRole('admin'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const result = await pipelinesService.shutdown({ by: ctx.user.email || ctx.user.id });
    await writeAudit(
      ctx,
      { action: 'pipelines.force_shutdown', entityType: 'pipeline', after: result as never },
      req,
    );
    res.json(result);
  }),
);

pipelinesRouter.post(
  '/resume',
  requireMinRole('admin'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const result = await pipelinesService.resume();
    await writeAudit(ctx, { action: 'pipelines.resume', entityType: 'pipeline' }, req);
    res.json(result);
  }),
);
