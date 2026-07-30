/**
 * Campaigns CRUD + start. Read Viewer+, write Editor+, start Manager+ (it kicks
 * off spend-incurring AI jobs, so it's gated a tier higher than plain writes).
 */
import { Router } from 'express';
import { CampaignCreateInput } from '@marketforge/contracts';
import { asyncHandler } from '../../lib/async-handler.js';
import { getCtx } from '../../lib/context.js';
import { parseOrThrow } from '../../lib/validate.js';
import { paginate, PaginationQuery } from '../../lib/pagination.js';
import { writeAudit } from '../../lib/audit.js';
import { requireMinRole } from '../../middleware/rbac.js';
import { campaignsService } from './service.js';

export const campaignsRouter: Router = Router();

campaignsRouter.get(
  '/',
  requireMinRole('viewer'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const page = parseOrThrow(PaginationQuery, req.query);
    const { items, total } = await campaignsService.list(ctx.orgId, page);
    res.json(paginate(items, total, page));
  }),
);

campaignsRouter.get(
  '/:id',
  requireMinRole('viewer'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    res.json(await campaignsService.get(ctx.orgId, req.params.id!));
  }),
);

campaignsRouter.post(
  '/',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const input = parseOrThrow(CampaignCreateInput, req.body);
    const campaign = await campaignsService.create(ctx.orgId, input);
    await writeAudit(ctx, { action: 'campaign.create', entityType: 'campaign', entityId: campaign.id, after: campaign }, req);
    res.status(201).json(campaign);
  }),
);

campaignsRouter.put(
  '/:id',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const input = parseOrThrow(CampaignCreateInput, req.body);
    const campaign = await campaignsService.update(ctx.orgId, req.params.id!, input);
    await writeAudit(ctx, { action: 'campaign.update', entityType: 'campaign', entityId: campaign.id, after: campaign }, req);
    res.json(campaign);
  }),
);

campaignsRouter.delete(
  '/:id',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const result = await campaignsService.remove(ctx.orgId, req.params.id!);
    await writeAudit(ctx, { action: 'campaign.delete', entityType: 'campaign', entityId: result.id }, req);
    res.status(204).end();
  }),
);

campaignsRouter.post(
  '/:id/start',
  requireMinRole('manager'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const result = await campaignsService.start(ctx.orgId, req.params.id!);
    await writeAudit(
      ctx,
      { action: 'campaign.start', entityType: 'campaign', entityId: req.params.id!, after: { enqueued: result.enqueued_jobs } },
      req,
    );
    res.status(202).json(result);
  }),
);
