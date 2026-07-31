/**
 * Brands CRUD routes. Read = Viewer+, write = Editor+ (RBAC). Inputs validated
 * with the Brand contract schemas; mutations audited.
 */
import { Router } from 'express';
import { z } from 'zod';
import { BrandCreateInput } from '@marketforge/contracts';
import { asyncHandler } from '../../lib/async-handler.js';
import { getCtx } from '../../lib/context.js';
import { parseOrThrow } from '../../lib/validate.js';
import { paginate, PaginationQuery } from '../../lib/pagination.js';
import { writeAudit } from '../../lib/audit.js';
import { requireMinRole } from '../../middleware/rbac.js';
import { brandsService } from './service.js';
import { brandKnowledgeService } from './knowledge-service.js';

export const brandsRouter: Router = Router();

// Seed the four default company brands (idempotent). Fixes the pipeline↔Brands mismatch.
brandsRouter.post(
  '/seed-defaults',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const result = await brandsService.seedDefaults(ctx.orgId);
    await writeAudit(ctx, { action: 'brand.seed_defaults', entityType: 'brand' }, req);
    res.json(result);
  }),
);

// --- Per-brand knowledge base (RAG) ---
brandsRouter.get(
  '/:brandId/knowledge',
  requireMinRole('viewer'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    res.json({ items: await brandKnowledgeService.list(ctx.orgId, req.params.brandId!) });
  }),
);

const KnowledgeInput = z.object({
  title: z.string().min(1),
  content: z.string().min(1),
  source: z.string().optional(),
});

brandsRouter.post(
  '/:brandId/knowledge',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const input = parseOrThrow(KnowledgeInput, req.body);
    res.status(201).json(await brandKnowledgeService.add(ctx.orgId, req.params.brandId!, input));
  }),
);

brandsRouter.post(
  '/:brandId/knowledge/refresh',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const result = await brandKnowledgeService.refresh(ctx.orgId, req.params.brandId!);
    await writeAudit(
      ctx,
      { action: 'brand.knowledge_refresh', entityType: 'brand', entityId: req.params.brandId },
      req,
    );
    res.json(result);
  }),
);

brandsRouter.delete(
  '/:brandId/knowledge/:id',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    res.json(await brandKnowledgeService.remove(ctx.orgId, req.params.brandId!, req.params.id!));
  }),
);

brandsRouter.get(
  '/',
  requireMinRole('viewer'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const page = parseOrThrow(PaginationQuery, req.query);
    const { items, total } = await brandsService.list(ctx.orgId, page);
    res.json(paginate(items, total, page));
  }),
);

brandsRouter.get(
  '/:id',
  requireMinRole('viewer'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    res.json(await brandsService.get(ctx.orgId, req.params.id!));
  }),
);

brandsRouter.post(
  '/',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const input = parseOrThrow(BrandCreateInput, req.body);
    const brand = await brandsService.create(ctx.orgId, input);
    await writeAudit(ctx, { action: 'brand.create', entityType: 'brand', entityId: brand.id, after: brand }, req);
    res.status(201).json(brand);
  }),
);

// Update: the web brand-edit form submits the full BrandCreateInput via PATCH
// (useUpdateBrand). Support PATCH and PUT with the same handler so the edit
// dialog persists on live data.
const updateHandler = asyncHandler(async (req, res) => {
  const ctx = getCtx(req);
  const input = parseOrThrow(BrandCreateInput, req.body);
  const brand = await brandsService.update(ctx.orgId, req.params.id!, input);
  await writeAudit(ctx, { action: 'brand.update', entityType: 'brand', entityId: brand.id, after: brand }, req);
  res.json(brand);
});

brandsRouter.put('/:id', requireMinRole('editor'), updateHandler);
brandsRouter.patch('/:id', requireMinRole('editor'), updateHandler);

brandsRouter.delete(
  '/:id',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const result = await brandsService.remove(ctx.orgId, req.params.id!);
    await writeAudit(ctx, { action: 'brand.delete', entityType: 'brand', entityId: result.id }, req);
    res.status(204).end();
  }),
);
