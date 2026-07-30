# MarketForge Foundation Build Plan

## SESSION_CONTEXT_RETRIEVAL
> Building the SHARED FOUNDATION of the MarketForge monorepo (root tooling + 8 shared packages).
> Downstream apps (apps/*) are owned by other agents — NOT in scope here.
> Layer order: root tooling → contracts+config+logger (base layer) → db/queue/secrets/auth/adapters
> (parallel, each owns its own package dir) → integrator (pnpm install + typecheck + git commit).

## STATUS: COMPLETE — pnpm install OK, `pnpm build` 8/8 OK, `pnpm typecheck` 11/11 OK,
## secrets tests 7/7 OK, committed `chore: bootstrap MarketForge monorepo foundation`.

## Build order (dependency-respecting)
- [x] Read ADRs, prompt.txt, research data model
- [ ] Root: package.json, pnpm-workspace.yaml, turbo.json, tsconfig.base.json, tsconfig.json,
      .gitignore, .nvmrc, .editorconfig, eslint.config.mjs, .prettierrc, .env.example, docker-compose.yml
- [ ] packages/config  (Zod env loader, APP_ENV prefix, OS paths)  — depends: none
- [ ] packages/logger  (pino factory + AI cost logger)             — depends: none
- [ ] packages/contracts (all Zod schemas + enums + job payloads)  — depends: none
- [ ] packages/db      (Drizzle schema + RLS migration + withTenant + seed) — depends: contracts, config
- [ ] packages/queue   (BullMQ queues + Scheduler + registerProcessor)      — depends: contracts, config
- [ ] packages/secrets (AES-256-GCM envelope encryption + key hashing)      — depends: config
- [ ] packages/auth    (Clerk + DEV_AUTH_BYPASS + requireRole)              — depends: contracts, config
- [ ] packages/adapters (interfaces + stubs + createAdapters factory)       — depends: contracts, config, logger
- [ ] Integrator: corepack pnpm install; pnpm -w typecheck; git init + one commit

## Rules honored
- Strict TS, no hardcoded secrets, cross-platform, RLS FORCE, envelope encryption, task/cost routing.
- Do NOT touch: CLAUDE.md, Master_Plan.md, Plan_WIP.md, research/, prompt.txt,
  social-post-scheduler.workflow.json, n8n.log, CLAUDE_REFERENCE/.
