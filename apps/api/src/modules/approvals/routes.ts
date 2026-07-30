/**
 * Approval-queue routes. GET /approvals is Viewer+ (visibility). approve/reject
 * are Manager+ (they gate what reaches real brand accounts). Approve applies the
 * trust-tier + score gate and may auto-schedule a publish.
 */
import { Router } from 'express';
import { z } from 'zod';
import { Uuid } from '@marketforge/contracts';
import { asyncHandler } from '../../lib/async-handler.js';
import { getCtx } from '../../lib/context.js';
import { parseOrThrow } from '../../lib/validate.js';
import { paginate, PaginationQuery } from '../../lib/pagination.js';
import { writeAudit } from '../../lib/audit.js';
import { requireMinRole } from '../../middleware/rbac.js';
import { approvalsService } from './service.js';

export const approvalsRouter: Router = Router();

const ApproveBody = z.object({
  threshold: z.number().min(0).max(100).optional(),
  scheduled_at: z.string().datetime({ offset: true }).optional(),
  timezone: z.string().min(1).optional(),
});

const RejectBody = z.object({
  reason: z.string().min(1).max(1000),
});

approvalsRouter.get(
  '/approvals',
  requireMinRole('viewer'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const page = parseOrThrow(PaginationQuery, req.query);
    const { items, total } = await approvalsService.list(ctx.orgId, page);
    res.json(paginate(items, total, page));
  }),
);

approvalsRouter.post(
  '/content-items/:id/approve',
  requireMinRole('manager'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const id = parseOrThrow(Uuid, req.params.id);
    const body = parseOrThrow(ApproveBody, req.body ?? {});
    const result = await approvalsService.approve(ctx.orgId, id, {
      threshold: body.threshold,
      scheduledAt: body.scheduled_at,
      timezone: body.timezone,
    });
    await writeAudit(
      ctx,
      { action: 'content_item.approve', entityType: 'content_item', entityId: id, after: { decision: result.decision } },
      req,
    );
    res.json(result);
  }),
);

approvalsRouter.post(
  '/content-items/:id/reject',
  requireMinRole('manager'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const id = parseOrThrow(Uuid, req.params.id);
    const body = parseOrThrow(RejectBody, req.body ?? {});
    const result = await approvalsService.reject(ctx.orgId, id, body.reason);
    await writeAudit(
      ctx,
      { action: 'content_item.reject', entityType: 'content_item', entityId: id, after: { reason: body.reason } },
      req,
    );
    res.json(result);
  }),
);
