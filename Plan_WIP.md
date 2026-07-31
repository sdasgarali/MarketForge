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

## VPS + Vercel deploy (2026-07-31) — IN PROGRESS
Decision: web → Vercel, backend → shared Hostinger VPS (187.124.74.175). API domain
`marketforge-api.neuraforz.com`; auth = **Clerk prod** (pilot).
- [x] Repo pushed to GitHub `sdasgarali/MarketForge`.
- [x] Deploy assets: `docker-compose.prod.yml` (APP_ENV=PROD, bypass off, api loopback via `!override`),
      `scripts/deploy.sh`, `docs/DEPLOYMENT_PLAN.md`. Dockerfile fixes: `migrator` stage (db:push/seed),
      worker builds full dep closure (`@marketforge/worker...`).
- [x] VPS backend LIVE via Docker: mf-postgres :5433, mf-redis :6380, mf-n8n :5679,
      **mf-api 127.0.0.1:8090 (/health 200)**, mf-worker (healthy, 9 processors, PROD). DB pushed + seeded
      (17 tables, Exzelon brand). Secrets generated on-box in `/opt/marketforge/.env` (chmod 600).
- [x] nginx site `marketforge-api.neuraforz.com` → 127.0.0.1:8090 (HTTP; 200 verified via Host header).
- [x] **USER ACTION 1 — DNS**: A record `marketforge-api.neuraforz.com` → 187.124.74.175 (grey cloud). HTTPS
      issued via `certbot --nginx` (account 4d2f), auto-renew scheduled, cert valid → 2026-10-29.
      `https://marketforge-api.neuraforz.com/health` → 200 (external).
- [x] **USER ACTION 2 — Clerk keys**: Clerk **Development** keys wired. Secret → VPS `.env`
      `PROD_CLERK_SECRET_KEY` (chmod 600, not committed) + mf-api restarted → authed routes now return 401
      (not 500) without a token. Publishable → Vercel env.
- [x] Vercel: `apps/web` deployed (project `marketforge-web`, scope asgar-ali-sayeds-projects). Env:
      `NEXT_PUBLIC_API_BASE_URL=https://marketforge-api.neuraforz.com`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`,
      `NEXT_PUBLIC_DEV_AUTH_BYPASS=0`. **LIVE: https://marketforge-web.vercel.app** (/ → /dashboard 200).
      Fixed next.config: gate `output:standalone`+tracingRoot behind `!VERCEL` (doubled-path deploy fail).
- [x] API `API_CORS_ORIGINS` set to the 3 vercel aliases + mf-api restarted; preflight 204 with
      `Access-Control-Allow-Origin: https://marketforge-web.vercel.app`.
- [x] **Clerk auth UX BUILT + deployed** (commits 731a040, d0e70f6): sign-in/sign-up routes, `<AuthGate>`
      (SignedOut→RedirectToSignIn), api-client attaches `Authorization: Bearer <Clerk token>` via
      `window.Clerk.session.getToken()`, `clerkMiddleware` (guarded), ClerkProvider URLs, topbar sign-out.
      Backend: `@clerk/backend` declared on **packages/auth** (the import-resolution site, not apps/api) →
      verifyToken works (bogus token → "Invalid or expired token", not "Clerk not installed"). API rebuilt;
      web redeployed. `/sign-in` 200 renders Clerk; middleware live (`X-Clerk-Auth-Status` header).
      Tenant resolution: web sends `x-org-id`=seed org `1111…1111` → RLS returns Exzelon (role=viewer).
- [ ] **Verify by real sign-in**: sign up at https://marketforge-web.vercel.app → dashboard should load
      Exzelon data. If Clerk blocks the Vercel origin, add it in Clerk dashboard → allowed origins.
- [ ] **Multi-tenant hardening (later)**: currently any authed Clerk user can pass `x-org-id`=seed org
      (single-pilot-org model). For true multi-tenant: Clerk orgs + webhook mirroring orgs/users/memberships
      into Postgres, drop client-supplied x-org-id trust. Also role is viewer (no writes) until org_role set.
- [ ] Follow-up: no committed SQL migrations — prod uses `db:push` (tech-debt); upgrade Clerk dev→prod keys
      later (needs Clerk domain CNAMEs on neuraforz.com); `scripts/deploy.sh` reruns the whole flow.

## Manual JWT auth (MongoDB) — REPLACED CLERK (2026-07-31) ✅ LIVE + TESTED
User dropped Clerk for own JWT login backed by MongoDB Atlas.
- Backend: `JwtAuthProvider` (HS256 via jose); `POST /auth/register` + `/auth/login` (public), Mongo
  user store (`marketforge.users`), scrypt password hashing. `createAuthProvider` prefers AUTH_JWT_SECRET.
  Users scoped to `AUTH_DEFAULT_ORG_ID` (seed org) → RLS returns Exzelon. Fixed Mongo connect-promise
  caching (don't cache rejected promise). Env on VPS: AUTH_JWT_SECRET, MONGODB_URI, MONGODB_DB.
- Frontend: Clerk fully removed; `lib/auth` (localStorage token), custom `/sign-in` + `/sign-up` forms,
  api-client sends `Bearer <jwt>`, AuthGate redirects when no token, topbar sign-out.
- **VERIFIED end-to-end in browser**: register + login via curl (token issued, /brands→Exzelon, wrong pw→401);
  browser login `founder@marketforge.app` → /dashboard shows "API connected" + Active brands 1 + "F" avatar.
- Atlas gotcha: cluster IP allowlist must include the VPS (user set 0.0.0.0/0). `atlas-credentials.env` gitignored.
- Note: Clerk backend code (packages/auth/clerk.ts, @clerk/backend dep) left in place but unused (JWT wins);
  Vercel Clerk env vars now unused/harmless. Single-pilot-org model unchanged (all users → seed org, admin).

## Remove n8n + website control panel (2026-07-31) — SLICES 1-3 DONE
- [x] **Slice 1 — n8n removed**: worker publish/analytics call adapters directly; deleted lib/n8n.js,
      apps/n8n/, N8N_* config/constants/compose/env. VPS n8n containers removed (--remove-orphans).
      Typecheck 19/19, worker tests 23/23. Port 5679 freed on VPS.
- [x] **Slice 2 — integrations backend**: `apps/api/modules/integrations` (admin, tenant-scoped)
      GET/PUT/DELETE /integrations. Provider registry (anthropic/openai/gemini/groq/openrouter/fal/
      elevenlabs/ayrshare/s3/google_drive). Creds = one envelope-encrypted JSON blob per provider in
      api_credentials (kind=provider:<id>); secrets write-only. Audited. `integrationsService.resolve()`
      ready for the worker.
- [x] **Slice 3 — Settings > Integrations UI**: real panel (useIntegrations + set/remove), per-provider
      fields, Connected status, Update/Remove. VERIFIED in browser: Anthropic (via API) + fal.ai (via UI)
      → "Connected". Deployed (VPS api + Vercel web).
- [ ] **Slice 4 — adapters consume per-org keys**: worker currently builds adapters from ENV at boot.
      Wire `integrationsService.resolve(orgId, provider)` into a per-org adapter builder (with cache +
      env fallback) so generation/publish use the org's OWN stored keys. THIS is what makes the saved
      keys actually take effect at generation time.
- [ ] **Slice 5 — social/publishing from UI**: surface social_accounts connect/disconnect per brand
      (backend service exists) in the brand detail page.
- [ ] **Slice 6 — automation & schedules from UI**: brand publishingSchedule + pipeline trigger controls;
      backend enqueue endpoints.

## Pipelines monitor + force-shutdown kill switch (2026-08-01) ✅ LIVE + TESTED
Interpreted operator's 3-pipeline diagram (Orchestrator / Video / Research) into a live monitor.
- queue: Redis global kill switch (engage/clear/status/isEngaged). worker base processor aborts every
  job (TerminalError) when engaged.
- api `/pipelines`: GET status (per-step live BullMQ counts → idle/queued/running/error/stopped),
  POST start (Auto button → resume + enqueue research), POST shutdown (engage kill switch + pause +
  obliterate ALL 9 queues), POST resume. Admin-gated + audited.
- web `/pipelines` (sidebar → Automation): 3 pipelines as step-flows with status dots, totals,
  Auto/Force-shutdown/Re-enable, kill-switch banner, company fan-out (Neuraforz/Exzelon/Medeoan/Tavakkul).
- VERIFIED in browser: monitor matches the diagrams; Force shutdown → banner "by founder@…" + all steps
  Stopped + 9 queues obliterated; Re-enable → clean. Deployed (VPS api+worker + Vercel web).
- NOTE: steps map to real queues so they light up when the actual pipeline runs; the named agents
  (character-design AI, Higgsfield, market-research AI) are the design targets — wiring them to real
  generation is future work (ties into Slice 4: adapters consume per-org keys).

## Multi-tenancy — IMPLEMENTED + ENFORCED (2026-08-01) ✅
Was single-pilot-org + RLS bypassed (app connected as superuser). Now real MT:
- **RLS enforcement**: created non-superuser/non-BYPASSRLS Postgres role `marketforge_app`
  (scripts/provision-app-role.sh); VPS `.env` PROD_DATABASE_URL → app role (ADMIN_URL stays superuser
  for migrations). RLS policies now actually filter by `app.current_org`.
- **Per-signup org**: register provisions a dedicated organization + global user + admin membership
  (apps/api/modules/auth/tenant.ts). JWT subject = Postgres user id (FK-safe); org_id = user's own org.
- **Token-bound tenant**: JwtAuthProvider dropped the client-supplied `x-org-id` override — a user only
  ever acts within the org their JWT was issued for. login prefers pgUserId (fallback Mongo id for legacy).
- **VERIFIED**: founder→Exzelon only; tenantA→own empty org, creates AliceCorp; tenantB→sees nothing
  (isolated); founder still only Exzelon. Spoof test: tenantB sending x-org-id=tenantA/seed → total:0.
  Browser: new signup "Carol" → dashboard Active brands 0 (own org). Deployed (VPS api+worker + Vercel).
- Legacy note: founder@marketforge.app + earlier Mongo users stay on the seed org (orgId unchanged);
  new signups get fresh orgs. Multi-org-per-user switching = future (/auth re-issue after membership check).

## Clickable pipeline tiles → per-step AI provider + key (2026-08-01) ✅ LIVE + TESTED
- Each step tile is clickable → StepConfigDialog: pick which provider powers it (eligible set by
  capability — text: anthropic/openai/gemini/groq/openrouter; image: fal; video: higgsfield/fal;
  storage: google_drive/s3) + save that provider API key inline (reuses /integrations, encrypted).
- api: GET /pipelines steps carry provider_options + selected_provider; PUT /pipelines/steps/:id/provider
  persists choice in organizations.settings.pipelineStepProviders (validated). Added Higgsfield provider.
- web: clickable StepNode shows chosen "AI: X"; dialog = provider picker + inline key form.
- VERIFIED browser (as tenant Carol): clicked AI 1 tile → picked OpenAI → saved key → Use provider →
  tile shows "AI: OpenAI" (persists across the 3s poll). Deployed (VPS api + Vercel web).
- NEXT: the per-step provider + key are stored; wiring the WORKER to actually build adapters from the
  chosen provider's key at generation time is the remaining piece (Slice 4 / makes steps go live).

## Brand + social run config on pipelines (2026-08-01) ✅ LIVE + TESTED
- Brand pills (All brands / Neuraforz / Exzelon / Medeoan / Tavakkul) + Social pills (Instagram/X/
  YouTube/TikTok/Facebook/LinkedIn) on the pipeline page. Start uses the selection.
- "All brands" → enqueues a research job per brand IN PARALLEL (verified runs:4).
- Duration→rounds plan: platform target seconds → ceil(target/10) 10s rounds (Instagram 60s = 6 rounds,
  the operator's "1min = 6×10s" rule). Folder template `<Brand>/videos/<topic>/`. Shown in a run-plan hint.
- api: PLATFORMS + buildRunPlan + planVideoRounds; POST /pipelines/start {brands,platform} returns plans.
- VERIFIED browser: "Start all 4 brands" + hint "6 × 10s clips per brand · <Brand>/videos/<topic>/ ·
  4 brands run in parallel". Deployed (VPS api + Vercel web).
- HONEST GAP (unchanged): this is the control surface + run PLANNING + parallel orchestration. Actual
  per-brand RAG, real Drive folder creation (topic subfolder), and looping video generation (6× rounds →
  store in the topic folder) need the GENERATION pipeline wired to real adapters/keys/Drive (Slice 4).
  Right now Start enqueues jobs that run as stubs (no real keys consumed).

## Generation pipeline WIRED to per-org keys (2026-08-01) ✅ LIVE + PROVEN
- adapters: AsyncLocalStorage override — `runWithAdapters(bundle, fn)` + `adapters` proxy. Every
  `adapters.*` call transparently uses a per-request bundle when one is active.
- worker `lib/org-adapters.ts`: `getOrgAdapters(orgId)` reads the org's encrypted provider keys
  (api_credentials, kind=provider:<id>) → builds an AdapterEnv overlay on env → createAdapters (cached
  60s, resilient fallback to default). base processor runs each job inside
  `runWithAdapters(getOrgAdapters(org_id), handler)` → agents/processors use the tenant's own keys.
- pipelines start now resolves brand_id from real brand records (brand buttons → actual brands) so runs
  reach generation. Worker tests 23/23, typecheck 19/19.
- **PROVEN on VPS**: started Exzelon run → research job used the org's saved ANTHROPIC key (real adapter,
  "All 1 provider(s) failed: anthropic" — bogus key). Stub would've faked success → confirms per-org keys
  power generation. Real key → real output.
- REMAINING refinements (not blocking): video rounds LOOP in generate-video (6× clips → concat to target),
  real Drive folder creation (<Brand>/videos/<topic>/), full stage chaining research→generate→video→store.
  Per-STEP provider selection (org.settings.pipelineStepProviders) is captured but adapter routing uses the
  org's configured providers set (not yet per-step granular).

## Google Drive wired (2026-08-01) ✅ auth VERIFIED
- Implemented real Drive v3 service-account client (packages/adapters/.../gdrive-client.ts): JWT RS256
  auth (node:crypto) → token → find/create folder, ensureFolderPath(<Brand>/videos/<topic>), multipart upload.
  No googleapis dep. Exported GDriveClient.
- POST /integrations/:provider/test → live connectivity check. worker org-adapters maps google_drive →
  GOOGLE_DRIVE_* env. UI: "Test connection" button on the Google Drive card + ai_video category.
- **VERIFIED on VPS** with Carol's saved creds: auth=TRUE (service account
  marketforge-storage@marketforge-504120.iam.gserviceaccount.com works); root_folder_ok=FALSE →
  the folder must be SHARED (Editor) with the SA email, or the Root folder id fixed. So creds are valid;
  only the Drive-side folder-share step remains (user action).
- REMAINING to fully store output: implement DriveMirror.mirror() to call the client, and wire drive-mirror
  processor to ensureFolderPath(<Brand>/videos/<topic>) + upload the generated asset. (Client is ready.)

## Blockers / Notes
- BLOCKER: 8 open questions must be answered before Phase 1 (platforms, budget, auto-publish policy,
  video-in-v1, launch scale, quality rubric, hosting, legal). See Master_Plan.md §2.
- Video deferred to Phase 3 (cost). Google Drive = mirror only, not primary store (3 req/s cap).
- MVP publishing = Ayrshare (absorbs LinkedIn/Meta app-review). Scheduler owned by backend, not n8n.
- Parked: Social Post Scheduler still needs Ayrshare key + Google auth + Media URL column to go live.
