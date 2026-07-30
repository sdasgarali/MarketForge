/**
 * Prompt-templates CRUD. Read Viewer+, create/update Editor+, delete Manager+.
 */
import { Router } from 'express';
import { Uuid } from '@marketforge/contracts';
import { asyncHandler } from '../../lib/async-handler.js';
import { getCtx } from '../../lib/context.js';
import { parseOrThrow } from '../../lib/validate.js';
import { paginate, PaginationQuery } from '../../lib/pagination.js';
import { writeAudit } from '../../lib/audit.js';
import { requireMinRole } from '../../middleware/rbac.js';
import { PromptTemplateInput, promptTemplatesService } from './service.js';

export const promptTemplatesRouter: Router = Router();

promptTemplatesRouter.get(
  '/',
  requireMinRole('viewer'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const page = parseOrThrow(PaginationQuery, req.query);
    const { items, total } = await promptTemplatesService.list(ctx.orgId, page);
    res.json(paginate(items, total, page));
  }),
);

promptTemplatesRouter.get(
  '/:id',
  requireMinRole('viewer'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    res.json(await promptTemplatesService.get(ctx.orgId, parseOrThrow(Uuid, req.params.id)));
  }),
);

promptTemplatesRouter.post(
  '/',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const input = parseOrThrow(PromptTemplateInput, req.body);
    const tpl = await promptTemplatesService.create(ctx.orgId, input);
    await writeAudit(ctx, { action: 'prompt_template.create', entityType: 'prompt_template', entityId: tpl.id, after: tpl }, req);
    res.status(201).json(tpl);
  }),
);

promptTemplatesRouter.put(
  '/:id',
  requireMinRole('editor'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const id = parseOrThrow(Uuid, req.params.id);
    const input = parseOrThrow(PromptTemplateInput, req.body);
    const tpl = await promptTemplatesService.update(ctx.orgId, id, input);
    await writeAudit(ctx, { action: 'prompt_template.update', entityType: 'prompt_template', entityId: id, after: tpl }, req);
    res.json(tpl);
  }),
);

promptTemplatesRouter.delete(
  '/:id',
  requireMinRole('manager'),
  asyncHandler(async (req, res) => {
    const ctx = getCtx(req);
    const id = parseOrThrow(Uuid, req.params.id);
    const result = await promptTemplatesService.remove(ctx.orgId, id);
    await writeAudit(ctx, { action: 'prompt_template.delete', entityType: 'prompt_template', entityId: result.id }, req);
    res.status(204).end();
  }),
);
