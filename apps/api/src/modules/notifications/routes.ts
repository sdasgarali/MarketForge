/**
 * Notifications read route. Viewer+ — returns the tenant's notifications
 * (dashboard channel + any recorded), newest first. Tenant-scoped via withTenant.
 */
import { Router } from 'express';
import { desc, sql } from 'drizzle-orm';
import { db, notifications, withTenant } from '@marketforge/db';
import { asyncHandler } from '../../lib/async-handler.js';
import { getCtx } from '../../lib/context.js';
import { parseOrThrow } from '../../lib/validate.js';
import { paginate, PaginationQuery } from '../../lib/pagination.js';
import { notificationToDto } from '../../lib/mappers.js';
import { requireMinRole } from '../../middleware/rbac.js';

export const notificationsRouter: Router = Router();

notificationsRouter.get(
  '/notifications',
  requireMinRole('viewer'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const page = parseOrThrow(PaginationQuery, req.query);
    const { items, total } = await withTenant(db, ctx.orgId, async (tx) => {
      const rows = await tx
        .select()
        .from(notifications)
        .orderBy(desc(notifications.createdAt))
        .limit(page.limit)
        .offset(page.offset);
      const [{ count } = { count: 0 }] = await tx
        .select({ count: sql<number>`count(*)::int` })
        .from(notifications);
      return { items: rows.map(notificationToDto), total: Number(count) };
    });
    res.json(paginate(items, total, page));
  }),
);
