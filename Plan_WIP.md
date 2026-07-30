# Plan WIP

## SESSION_CONTEXT_RETRIEVAL
> Building the **MarketForge** MVP monorepo (user said "implement all, discuss cost later").
> Foundations + decisions done. IMPLEMENTATION IN PROGRESS: foundation packages first, then
> parallel fan-out (backend/worker/adapters/web/n8n), then integrator pass (install + typecheck +
> commit). Cost/publisher-tier (Ayrshare Premium vs Postiz) intentionally DEFERRED — adapters make
> it swappable. Repo root = E:\chapter 2\N8N.
> NEXT STEP: check foundation agent output → fan out app-slice agents → integrate + commit.

## Decisions locked (2026-07-31)
- MVP platforms: **X + Instagram** · Budget: **lean < $500/mo** · Policy: **per-brand trust tiers** ·
  Video: **deferred to Phase 3**, roster includes **Kling (via fal)**.

## Immediate TODO
- [ ] DECIDE §2a: MVP publisher tier — **Ayrshare Premium (~$149)** vs **self-host Postiz (free)**
- [ ] Answer remaining questions 5–8 (scale / quality rubric / hosting / legal) — not blocking scaffolding
- [ ] Approve go-ahead to bootstrap the monorepo
- [ ] Bootstrap monorepo (pnpm + Turborepo) + Docker Compose (Postgres/Redis/n8n) + `.env` scheme + CI skeleton
- [ ] Stand up Clerk auth + orgs mirrored to Postgres (RLS)

## Completed
- [x] n8n running locally on :5678, owner account created (2026-07-30)
- [x] Exzelon tracker uploaded to Google Sheets (2026-07-30)
- [x] Standalone Social Post Scheduler workflow built — `social-post-scheduler.workflow.json` (2026-07-30, parked)
- [x] Analyzed prompt.txt; 4-stream requirements research → `research/*.md` (2026-07-30)
- [x] Locked architecture decisions; wrote CLAUDE.md, Master_Plan.md, CLAUDE_REFERENCE/ (2026-07-30)

## Blockers / Notes
- BLOCKER: 8 open questions must be answered before Phase 1 (platforms, budget, auto-publish policy,
  video-in-v1, launch scale, quality rubric, hosting, legal). See Master_Plan.md §2.
- Video deferred to Phase 3 (cost). Google Drive = mirror only, not primary store (3 req/s cap).
- MVP publishing = Ayrshare (absorbs LinkedIn/Meta app-review). Scheduler owned by backend, not n8n.
- Parked: Social Post Scheduler still needs Ayrshare key + Google auth + Media URL column to go live.
