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
- [ ] Provision infra: `docker compose up -d` → `db:migrate` → `db:seed` → `pnpm dev`; end-to-end smoke test the loop
- [ ] Provide real API keys in `.env` (Anthropic, fal, Ayrshare, S3, Clerk) to exercise adapters live
- [ ] DECIDE §2a: MVP publisher tier — **Ayrshare Premium (~$149)** vs **self-host Postiz (free)** (adapter already swappable)
- [ ] Answer remaining questions 5–8 (scale / quality rubric / hosting / legal)
- [ ] CI pipeline (GitHub Actions: install/typecheck/test/build) + push to a remote
- [ ] Phase 2 breadth (LinkedIn/YouTube, full review suite, remaining agents, billing) per Master_Plan

## Completed
- [x] MEDIA-SCOPE: scoped video to **Kling short-form (≤15s) + GIF export + poster images**; long-form
      PAUSED (skip + notify, no spend) behind `VIDEO_ALLOW_LONGFORM`. Added config env vars
      (VIDEO_ENABLED/ALLOW_LONGFORM/SHORT_MAX_S, GIF_MAX_S, VIDEO_DEFAULT_MODEL; legacy WORKER_ENABLE_VIDEO
      mapped for back-compat), contracts (generate-video output_format+longform, ContentType 'poster'),
      pure `resolveMediaPlan` + 15 unit tests, rewrote generate-video processor (short/gif/paused),
      ffmpeg-static gif export helper w/ graceful fallback, poster prompt + ideogram routing. Docs updated
      (CLAUDE.md, ADR-007, Master_Plan). typecheck 19/19, tests green (worker 23). (2026-07-31)
- [x] n8n running locally on :5678, owner account created (2026-07-30)
- [x] Exzelon tracker uploaded to Google Sheets (2026-07-30)
- [x] Standalone Social Post Scheduler workflow built — `social-post-scheduler.workflow.json` (2026-07-30, parked)
- [x] Analyzed prompt.txt; 4-stream requirements research → `research/*.md` (2026-07-30)
- [x] Locked architecture decisions; wrote CLAUDE.md, Master_Plan.md, CLAUDE_REFERENCE/ (2026-07-30)
- [x] Built MVP monorepo: foundation (8 pkgs) + api + worker + web + real adapters + n8n workflows;
      19/19 typecheck, 11/11 build, 60 tests green; docker-compose (infra + `full` profile); README (2026-07-31)

## Blockers / Notes
- BLOCKER: 8 open questions must be answered before Phase 1 (platforms, budget, auto-publish policy,
  video-in-v1, launch scale, quality rubric, hosting, legal). See Master_Plan.md §2.
- Video deferred to Phase 3 (cost). Google Drive = mirror only, not primary store (3 req/s cap).
- MVP publishing = Ayrshare (absorbs LinkedIn/Meta app-review). Scheduler owned by backend, not n8n.
- Parked: Social Post Scheduler still needs Ayrshare key + Google auth + Media URL column to go live.
