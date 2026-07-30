/**
 * Dashboard + analytics read routes. Viewer+ (read-only reporting).
 */
import { Router } from 'express';
import { Platform, Uuid } from '@marketforge/contracts';
import { asyncHandler } from '../../lib/async-handler.js';
import { getCtx } from '../../lib/context.js';
import { parseOrThrow } from '../../lib/validate.js';
import { requireMinRole } from '../../middleware/rbac.js';
import { dashboardService } from './service.js';
import { z } from 'zod';

export const dashboardRouter: Router = Router();

// /analytics returns an aggregated AnalyticsSummary (not a paginated list), so
// it takes a range + optional brand/platform filter rather than limit/offset.
const AnalyticsQuery = z.object({
  range: z.string().optional(),
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
    const summary = await dashboardService.analytics(ctx.orgId, {
      brandId: q.brand_id,
      platform: q.platform,
    });
    res.json(summary);
  }),
);
