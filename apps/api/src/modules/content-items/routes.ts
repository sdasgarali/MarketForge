/**
 * Content-items routes. List/get Viewer+; regenerate Editor+ (incurs AI spend).
 * List supports ?status=&brand_id=&campaign_id= filters plus pagination.
 */
import { Router } from 'express';
import { z } from 'zod';
import { ContentStatus, Platform, Uuid } from '@marketforge/contracts';
import { asyncHandler } from '../../lib/async-handler.js';
import { getCtx } from '../../lib/context.js';
import { parseOrThrow } from '../../lib/validate.js';
import { paginate, PaginationQuery } from '../../lib/pagination.js';
import { writeAudit } from '../../lib/audit.js';
import { requireMinRole } from '../../middleware/rbac.js';
import { contentItemsService } from './service.js';

export const contentItemsRouter: Router = Router();

// The web content hook sends ?status=&platform=&brand=&campaign= (bare `brand`/
// `campaign`, not `*_id`). Accept both spellings so the filters actually apply.
const ListQuery = PaginationQuery.extend({
  status: ContentStatus.optional(),
  platform: Platform.optional(),
  brand: Uuid.optional(),
  brand_id: Uuid.optional(),
  campaign: Uuid.optional(),
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
      {
        status: q.status,
        platform: q.platform,
        brandId: q.brand ?? q.brand_id,
        campaignId: q.campaign ?? q.campaign_id,
      },
      q,
    );
    res.json(paginate(items, total, q));
  }),
);

const DateStr = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'expected YYYY-MM-DD');

const CalendarQuery = z.object({
  brand_id: Uuid.optional(),
  platform: Platform.optional(),
  start: DateStr,
  end: DateStr,
});

// Calendar: date × platform content for a window. Viewer+.
contentItemsRouter.get(
  '/calendar',
  requireMinRole('viewer'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const q = parseOrThrow(CalendarQuery, req.query);
    res.json(
      await contentItemsService.calendar(ctx.orgId, {
        brandId: q.brand_id,
        platform: q.platform,
        start: q.start,
        end: q.end,
      }),
    );
  }),
);

const ContentItemBody = z.object({
  brand_id: Uuid,
  platform: Platform,
  content_type: z.string().max(40).optional(),
  scheduled_date: DateStr.optional(),
  slot_index: z.number().int().min(0).max(48).optional(),
  language: z.string().max(10).optional(),
  title: z.string().max(300).optional(),
  body: z.string().max(20000).optional(),
  caption: z.string().max(5000).optional(),
  hashtags: z.array(z.string().max(80)).max(60).optional(),
  characters: z.string().max(5000).optional(),
  story_prompt: z.string().max(5000).optional(),
  image_prompt: z.string().max(5000).optional(),
});

// Manually author a calendar cell. Editor+.
contentItemsRouter.post(
  '/',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const input = parseOrThrow(ContentItemBody, req.body);
    const item = await contentItemsService.create(ctx.orgId, input);
    await writeAudit(
      ctx,
      { action: 'content_item.create', entityType: 'content_item', entityId: item.id, after: { platform: item.platform } },
      req,
    );
    res.status(201).json(item);
  }),
);

// Manually edit a content item (calendar editor). Editor+.
contentItemsRouter.patch(
  '/:id',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const id = parseOrThrow(Uuid, req.params.id);
    const input = parseOrThrow(ContentItemBody.partial(), req.body);
    const item = await contentItemsService.update(ctx.orgId, id, input);
    await writeAudit(
      ctx,
      { action: 'content_item.update', entityType: 'content_item', entityId: id },
      req,
    );
    res.json(item);
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

const GenerateVideoBody = z.object({
  duration_s: z.number().positive().max(60).optional(),
  output_format: z.enum(['mp4', 'gif']).optional(),
  model_hint: z.string().max(60).optional(),
});

// Manual "Generate Video" trigger for a content item. Editor+ (incurs AI spend).
contentItemsRouter.post(
  '/:id/generate-video',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const id = parseOrThrow(Uuid, req.params.id);
    const body = parseOrThrow(GenerateVideoBody, req.body ?? {});
    const result = await contentItemsService.generateVideo(ctx.orgId, id, body);
    await writeAudit(
      ctx,
      { action: 'content_item.generate_video', entityType: 'content_item', entityId: id, after: { job_id: result.job_id } },
      req,
    );
    res.status(202).json(result);
  }),
);

// Keep zod referenced for schema extension typing.
export type ContentItemListQuery = z.infer<typeof ListQuery>;
