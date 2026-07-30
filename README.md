# MarketForge

Enterprise, multi-brand **AI marketing-automation platform**. Core loop:
**Research → Generate (copy + image) → AI Review/Score → Approve → Schedule → Publish → Analytics → Optimize**, multi-tenant, minimal human touch. See `prompt.txt` (source spec), `CLAUDE.md` (rules + decisions), `Master_Plan.md` (roadmap), `CLAUDE_REFERENCE/architecture-decisions.md` (10 ADRs), `research/*.md` (deep research).

> **Status:** MVP scaffold complete — all packages/apps build, typecheck, and test green. Publishing/model cost tiers are deliberately swappable (adapter-based) and tuned later.

## Monorepo layout
```
apps/
  web/      Next.js dashboard (App Router, Tailwind, ShadCN, React Query)
  api/      Express REST API (auth/RBAC/tenant, trust-tier publishing gate)
  worker/   BullMQ processors — the content pipeline (research→…→analytics)
  n8n/      Modular n8n sub-workflows (publish, analytics, error handler)
packages/
  config    env loader (APP_ENV=TEST|DEV|PROD prefix scheme, Zod-validated)
  logger    pino structured logging + AI cost/token logging
  contracts Zod schemas + types + enums + job payloads (shared source of truth)
  db        Drizzle schema + Postgres RLS (tenant isolation) + migrate/seed
  queue     BullMQ queues + backend-owned Scheduler + registerProcessor
  secrets   envelope encryption (AES-256-GCM) + API-key hashing
  auth      Clerk provider (+ DEV_AUTH_BYPASS) + RBAC guards + TenantContext
  adapters  LLM / image / video / voice / publisher / storage adapters
```

## Prerequisites
- Node 22, pnpm 9 (`corepack enable pnpm`), Docker Desktop.

## Quick start (dev)
```bash
cp .env.example .env            # fill keys as needed; DEV_AUTH_BYPASS=1 runs without Clerk
pnpm install
docker compose up -d            # infra only: postgres + redis + n8n (queue mode)
pnpm --filter @marketforge/db db:migrate
pnpm --filter @marketforge/db db:seed        # org + admin + "Exzelon" brand
pnpm dev                        # runs api (:8080), web (:3000), worker together (turbo)
```
Open **http://localhost:3000** (dashboard) · API **http://localhost:8080/health** · n8n **http://localhost:5678**.

Run the whole stack in containers instead:
```bash
docker compose --profile full up --build     # postgres, redis, n8n, migrate, api, worker, web
```

## Verify
```bash
pnpm -w typecheck     # 19/19 packages
pnpm -w build         # 11/11
pnpm -w test          # 60 tests across secrets/adapters/api/worker
```

## Key decisions (see CLAUDE_REFERENCE/architecture-decisions.md)
Multi-tenancy = Postgres RLS · Auth = Clerk · Publishing = Ayrshare adapter (swappable) ·
**Scheduler owned by backend (BullMQ), n8n is integration-only** · Storage = S3 primary + Drive mirror ·
AI = task/cost-routed adapters (Claude Sonnet/Opus, fal images, ElevenLabs voice; Kling-via-fal video in Phase 3).

## MVP scope (locked)
Platforms **X + Instagram**, **image-only** (video → Phase 3), **per-brand trust-tier** approval,
lean (< $500/mo) model routing. Roadmap + open questions in `Master_Plan.md`.
