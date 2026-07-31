# Plan WIP

## SESSION_CONTEXT_RETRIEVAL
> **Local stack is LIVE** (2026-07-31). Full bring-up done: Docker infra (mf-postgres :5433,
> mf-redis :6380, mf-n8n :5678 — all healthy) + migrate + seed (org/admin/Exzelon brand) + all
> three apps up (api :8080 healthy, worker 9 processors + health :9090, web :3000 → /dashboard 200).
> API smoke-tested with `x-org-id: 1111…1111` (seed org): /brands returns Exzelon, /dashboard/summary,
> /analytics, /content-items all return correct envelopes. RLS scoping verified (1 brand for org).
> FIXED: config `.env` loader was CWD-relative → broke every entrypoint launched from a package dir
> (db scripts, api/worker under turbo). Now walks UP to repo-root `.env` (loadEnv + new `loadRootEnv()`);
> wired into migrate.ts/push.ts. 12/12 test tasks green, config+db typecheck clean.
> NEXT STEP: full pipeline loop (Research→Generate→…→Publish) needs REAL API keys (Anthropic/fal/
> Ayrshare) — adapters inert without them. Enqueue a job to test queue wiring, or provide keys.
> To restart stack: `docker compose up -d` (infra already persists via restart:unless-stopped) → `pnpm dev`.

## Decisions locked (2026-07-31)
- MVP platforms: **X + Instagram** · Budget: **lean < $500/mo** · Policy: **per-brand trust tiers** ·
  Video: **deferred to Phase 3**, roster includes **Kling (via fal)**.

## Immediate TODO
- [x] Provision infra: `docker compose up -d` → `db:migrate` → `db:seed` → `pnpm dev`; stack LIVE + read-path smoke-tested (2026-07-31). Full generate→publish loop still needs real keys.
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

## API↔Web contract reconciliation (2026-07-31) — apps/api only  [DONE]
- [x] 1. /analytics → AnalyticsSummary {by_platform, timeseries, totals} (30-day zero-filled)
- [x] 2. /content-items list: accept platform/brand/campaign query keys + platform filter
- [x] 3. contentItemToDto: add scheduled_at (publish_jobs join) + image_url (assets join)
- [x] 4. /content-items/:id → { item, composite, reviews }
- [x] 5. /approvals → Paginated<ApprovalItem> {content_item, composite, reviews, brand_name}
- [x] 6. brandToDto: always emit approval_settings (default) — brand-detail derefs it
- [x] 7. brands PATCH route added (PUT+PATCH share handler)
- [x] 8. typecheck PASS · api tests 10/10 · curl-verified envelopes live
Notes: image_url resolves from asset driveFileId (Drive URL); S3-only keys → undefined (needs signed-URL layer).

## Blockers / Notes
- BLOCKER: 8 open questions must be answered before Phase 1 (platforms, budget, auto-publish policy,
  video-in-v1, launch scale, quality rubric, hosting, legal). See Master_Plan.md §2.
- Video deferred to Phase 3 (cost). Google Drive = mirror only, not primary store (3 req/s cap).
- MVP publishing = Ayrshare (absorbs LinkedIn/Meta app-review). Scheduler owned by backend, not n8n.
- Parked: Social Post Scheduler still needs Ayrshare key + Google auth + Media URL column to go live.
