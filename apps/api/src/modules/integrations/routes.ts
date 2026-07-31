/**
 * Integration settings — manage provider credentials (AI, publishing, storage)
 * from the website. Admin-only, tenant-scoped. Secrets are write-only; GET never
 * returns them (only configured status + non-secret fields).
 */
import { Router } from 'express';
import { z } from 'zod';
import { asyncHandler } from '../../lib/async-handler.js';
import { getCtx } from '../../lib/context.js';
import { requireMinRole } from '../../middleware/rbac.js';
import { parseOrThrow } from '../../lib/validate.js';
import { writeAudit } from '../../lib/audit.js';
import { integrationsService } from './service.js';

export const integrationsRouter: Router = Router();

const SetInput = z.object({
  values: z.record(z.string(), z.string()),
});

integrationsRouter.get(
  '/',
  requireMinRole('admin'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    res.json({ items: await integrationsService.list(ctx.orgId) });
  }),
);

integrationsRouter.put(
  '/:provider',
  requireMinRole('admin'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const provider = req.params.provider as string;
    const { values } = parseOrThrow(SetInput, req.body);
    const result = await integrationsService.set(ctx.orgId, provider, values);
    await writeAudit(
      ctx,
      { action: 'integration.configured', entityType: 'integration', entityId: provider },
      req,
    );
    res.json(result);
  }),
);

integrationsRouter.delete(
  '/:provider',
  requireMinRole('admin'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const provider = req.params.provider as string;
    const result = await integrationsService.remove(ctx.orgId, provider);
    await writeAudit(
      ctx,
      { action: 'integration.removed', entityType: 'integration', entityId: provider },
      req,
    );
    res.json(result);
  }),
);
