/**
 * Content-items routes. List/get Viewer+; regenerate Editor+ (incurs AI spend).
 * List supports ?status=&brand_id=&campaign_id= filters plus pagination.
 */
import { Router } from 'express';
import type { z } from 'zod';
import { ContentStatus, Uuid } from '@marketforge/contracts';
import { asyncHandler } from '../../lib/async-handler.js';
import { getCtx } from '../../lib/context.js';
import { parseOrThrow } from '../../lib/validate.js';
import { paginate, PaginationQuery } from '../../lib/pagination.js';
import { writeAudit } from '../../lib/audit.js';
import { requireMinRole } from '../../middleware/rbac.js';
import { contentItemsService } from './service.js';

export const contentItemsRouter: Router = Router();

const ListQuery = PaginationQuery.extend({
  status: ContentStatus.optional(),
  brand_id: Uuid.optional(),
  campaign_id: Uuid.optional(),
});

contentItemsRouter.get(
  '/',
  requireMinRole('viewer'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const q = parseOrThrow(ListQuery, req.query);
    const { items, total } = await contentItemsService.list(
      ctx.orgId,
      { status: q.status, brandId: q.brand_id, campaignId: q.campaign_id },
      q,
    );
    res.json(paginate(items, total, q));
  }),
);

contentItemsRouter.get(
  '/:id',
  requireMinRole('viewer'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const id = parseOrThrow(Uuid, req.params.id);
    res.json(await contentItemsService.get(ctx.orgId, id));
  }),
);

contentItemsRouter.post(
  '/:id/regenerate',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const id = parseOrThrow(Uuid, req.params.id);
    const result = await contentItemsService.regenerate(ctx.orgId, id);
    await writeAudit(
      ctx,
      { action: 'content_item.regenerate', entityType: 'content_item', entityId: id, after: { job_id: result.job_id } },
      req,
    );
    res.status(202).json(result);
  }),
);

// Keep zod referenced for schema extension typing.
export type ContentItemListQuery = z.infer<typeof ListQuery>;
