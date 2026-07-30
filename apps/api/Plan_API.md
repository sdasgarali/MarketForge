# MarketForge API Service — Build Plan

## SESSION_CONTEXT_RETRIEVAL
> Building `apps/api/**` (Express + TS, DDD-ish) against the DONE foundation packages.
> Scope is EXCLUSIVELY apps/api. Consume @marketforge/{config,logger,contracts,db,queue,auth,secrets,adapters}.

## Layering
- config/ : app config surface (port, cors, rate-limit) sourced from @marketforge/config env.
- http/errors.ts : AppError taxonomy + problem+json mapping.
- lib/ : asyncHandler, validate (zod), audit helper, pagination, mappers (row->DTO).
- middleware/ : requestId, authContext, errorHandler, notFound.
- modules/<domain>/{routes,controller,service}.ts

## Middleware order
request-id -> pino-http -> helmet -> cors -> rate-limit -> json body -> authContext -> routes -> notFound -> errorHandler

## Endpoints (RBAC)
- GET /health (no auth), GET /ready (no auth; db+redis)
- GET /me (any authed)
- Brands CRUD: read Viewer+, write Editor+
- /brands/:id/social-accounts CRUD: Editor+ (secrets encrypted)
- Campaigns CRUD Editor+; POST /campaigns/:id/start Manager+ (enqueue research/generate-text)
- Content items: GET list/one Viewer+; POST /:id/regenerate Editor+
- Approvals: GET /approvals Viewer+; approve/reject Manager+ (trust-tier gate + Scheduler)
- Prompt templates CRUD Editor+ (Manager+ delete)
- Dashboard: GET /dashboard/summary, GET /analytics Viewer+
- Notifications GET Viewer+
- API keys: POST /api-keys Admin (return once, store hash)

## publishingPolicy service (pure, unit-tested)
input: trustTier, compositeScore, threshold, approvalSettings(mode,min_score,trust_tier)
-> decision: 'auto-schedule' | 'require-approval' | 'block'

## Tests (vitest)
- publishingPolicy.test.ts (matrix)
- brands.service.test.ts (mock withTenant/db)

## Acceptance
- pnpm --filter @marketforge/api typecheck passes.
