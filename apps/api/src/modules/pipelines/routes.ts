/**
 * Pipelines monitor + control. GET status is manager+; start/shutdown/resume are
 * admin-only (they mutate live processing). Force-shutdown is audited.
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { getCtx } from '../../lib/context.js';
import { requireMinRole } from '../../middleware/rbac.js';
import { writeAudit } from '../../lib/audit.js';
import { parseOrThrow } from '../../lib/validate.js';
import { pipelinesService } from './service.js';

export const pipelinesRouter: Router = Router();

pipelinesRouter.get(
  '/',
  requireMinRole('viewer'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    res.json(await pipelinesService.status(ctx.orgId));
  }),
);

const SetProviderInput = z.object({ provider: z.string().min(1) });

pipelinesRouter.put(
  '/steps/:stepId/provider',
  requireMinRole('admin'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const stepId = req.params.stepId as string;
    const { provider } = parseOrThrow(SetProviderInput, req.body);
    const result = await pipelinesService.setStepProvider(ctx.orgId, stepId, provider);
    await writeAudit(
      ctx,
      { action: 'pipelines.set_step_provider', entityType: 'pipeline', entityId: stepId },
      req,
    );
    res.json(result);
  }),
);

const StartInput = z.object({
  brands: z.array(z.string()).optional(),
  platform: z.string().optional(),
});

pipelinesRouter.post(
  '/start',
  requireMinRole('admin'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const input = parseOrThrow(StartInput, req.body ?? {});
    const result = await pipelinesService.start(ctx.orgId, input);
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
