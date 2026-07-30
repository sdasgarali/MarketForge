/**
 * Dashboard + analytics read routes. Viewer+ (read-only reporting).
 */
import { Router } from 'express';
import { Platform, Uuid } from '@marketforge/contracts';
import { asyncHandler } from '../../lib/async-handler.js';
import { getCtx } from '../../lib/context.js';
import { parseOrThrow } from '../../lib/validate.js';
import { PaginationQuery } from '../../lib/pagination.js';
import { requireMinRole } from '../../middleware/rbac.js';
import { dashboardService } from './service.js';

export const dashboardRouter: Router = Router();

const AnalyticsQuery = PaginationQuery.extend({
  brand_id: Uuid.optional(),
  platform: Platform.optional(),
});

dashboardRouter.get(
  '/dashboard/summary',
  requireMinRole('viewer'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    res.json(await dashboardService.summary(ctx.orgId));
  }),
);

dashboardRouter.get(
  '/analytics',
  requireMinRole('viewer'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const q = parseOrThrow(AnalyticsQuery, req.query);
    const rows = await dashboardService.analytics(
      ctx.orgId,
      { brandId: q.brand_id, platform: q.platform },
      q.limit,
      q.offset,
    );
    res.json({ items: rows, total: rows.length, limit: q.limit, offset: q.offset });
  }),
);
