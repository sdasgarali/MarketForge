# Master Plan — AI Marketing Automation Platform (MarketForge)

> The phased roadmap. Detailed rationale in `research/*.md`. Decisions in
> `CLAUDE_REFERENCE/architecture-decisions.md`. Status resume in `Plan_WIP.md`.

## 1. Reality check (from research)
The `prompt.txt` spec is a **12–18 month, multi-engineer product**, not a workflow. It also
contains a built-in tension ("minimal human intervention / Auto Mode" **and** "never publish
immediately / multi-stage review") and scale targets (500 brands, 10k assets/day, 1k posts/day)
that hit **hard external limits** — platform API quotas and AI/video cost — long before they hit
our code. The plan therefore: **design multi-tenant + queue-based from day 1, but ship a narrow,
correct MVP first**, and treat scale/video as later, budgeted phases.

## 2. Open questions

### ANSWERED 2026-07-31
1. **Platforms for MVP** → **X + Instagram** (least-gated, via aggregator).
2. **AI monthly budget** → **Lean, < $500/mo** total. Image-only MVP, cheap-tier routing, no video.
3. **Auto-publish policy** → **per-brand trust tiers** (new = approval required; trusted may auto-publish).
4. **Video in v1?** → **MEDIA-SCOPE (revised 2026-07-31):** short-form only is IN near-term — **Kling
   short-form (≤15s) via fal + GIF loops (≤6s) + poster images**. Big/**long-form video stays Phase 3**
   and is **PAUSED** by default (skip + notify, no spend); re-enable via `VIDEO_ALLOW_LONGFORM`. Kling via
   fal.ai, not native (ADR-007).

### 2a. NEW blocker created by the lean budget (needs a call)
- **Ayrshare Business is ~$599/mo — over the < $500 ceiling.** Options for MVP:
  - **A) Ayrshare Premium (~$149/mo, single brand)** — cheapest managed path, absorbs Meta app-review, fits budget while pilot = 1 brand. Upgrade to Business when adding brands. *(Recommended)*
  - **B) Self-host Postiz (free/OSS)** — $0 licence, preserves budget for AI, but adds ops + you handle Meta/X app onboarding yourself (X needs none; Instagram still needs a Meta app + business verification).
  - Decision needed before Phase 1 publishing work.

### STILL OPEN (needed before/early in Phase 1, not blocking scaffolding)
5. **Launch scale (first 3 months)** — realistic # brands + posts/day. (Design for many, load-test for real.)
6. **Quality "score ≥ 90"** — existing rubric, or define the composite score? (Default: we define it.)
7. **Hosting** — MVP on the shared Hostinger VPS (dev/pilot) vs managed cloud from the start?
8. **Legal posture** — AI-generated people, AI-content disclosure, GDPR/data-residency needs?

## 3. Phase plan

### Phase 0 — Foundations & decisions  (NOW · ~1 week · in progress)
- [x] Analyze spec, run requirements research (4 streams)
- [x] Lock core architecture decisions (see ADR doc)
- [x] Create project CLAUDE.md + CLAUDE_REFERENCE scaffold
- [ ] **Answer the 8 open questions above** ← awaiting user
- [ ] Approve Phase 1 scope
- [ ] Bootstrap monorepo (pnpm + Turborepo), Docker Compose (PG/Redis/n8n), CI skeleton, `.env` scheme

### Phase 1 — MVP: prove the core loop  (~8–10 weeks · 2–3 eng)
Scope: **ONE brand → small multi-tenant, X + Instagram, text + 1 image, per-brand trust-tier approval, no video.** Lean < $500/mo.
- [ ] Auth + orgs (Clerk) mirrored to Postgres; RBAC + RLS enforced
- [ ] Core data model (orgs, users, brands, social_accounts, campaigns, content_items, assets, review_results, publish_jobs, analytics, prompts, audit_logs) — schema in `research/04`
- [ ] Brand profile CRUD (subset of the 30 brand fields — enough to drive generation)
- [ ] ~6 agents only: Research, Copywriter, Image-Prompt, Brand-Compliance/QA (scoring), Publishing, Analytics
- [ ] Generation adapters: LLM (Claude Sonnet 4.6) + image (nano-banana-2 MCP / fal) behind interfaces
- [ ] AI review + composite score + bounded auto-regen (< threshold → regenerate, capped)
- [ ] Approval queue UI
- [ ] Backend scheduler (BullMQ delayed jobs), timezone-aware, idempotent, retrying
- [ ] Publish via Ayrshare (`PublisherAdapter`) to the 2 platforms; verify + store URL/id/timestamp
- [ ] Modular n8n sub-workflows for the actual publish calls (queue mode)
- [ ] Basic analytics pull + dashboard tiles; full logging w/ per-run cost/token
- [ ] Notifications: email + one chat channel (Slack/Telegram)
- [ ] **Scoped media (MEDIA-SCOPE):** Kling short-form (≤15s) via fal + GIF export (≤6s silent → .gif via
      ffmpeg-static) + poster images (text-strong via ideogram). `resolveMediaPlan` gates it; long-form
      paused (skip + notify, no spend) behind `VIDEO_ALLOW_LONGFORM`.
- **Exit criteria:** a scheduled post goes brief → published on 2 platforms with review+approval, fully logged, with analytics returning — for 5–20 pilot brands.

### Phase 2 — Breadth & operations  (~8–12 weeks)
- [ ] Add LinkedIn + YouTube (via aggregator/partner) + full platform-specific content variants
- [ ] Full review suite (grammar, fact-check, copyright, SEO, visual, policy, duplicate, accessibility)
- [ ] Remaining agents (Strategist, Planner, Script, Hashtag, Thumbnail, Error-Recovery, Cost-Optimizer, etc.)
- [ ] Media Library, Content Calendar, Research Center, Workflow Monitor, Reports, Prompt Library UIs
- [ ] Google Drive mirror (rate-limited, per-brand folder tree), Asset Manager
- [ ] Billing (Stripe) + usage metering; API Manager / Integrations screens
- [ ] Notification fan-out (Slack/Discord/Telegram/email/dashboard)

### Phase 3 — Rich media & scale  (~8–12 weeks)
- [ ] **Long-form / big video** (Veo 3.1 MCP + Runway + fal), metered + segment-stitching — the piece kept
      PAUSED by MEDIA-SCOPE; enable via `VIDEO_ALLOW_LONGFORM`. (Short-form/GIF/poster already shipped in Phase 1.)
- [ ] Voice + subtitle pipeline (ElevenLabs)
- [ ] Character generation w/ enforced moderation gate
- [ ] Self-host bulk image gen (Flux/SDXL on ComfyUI) — break-even at ~1k+ imgs/day
- [ ] K8s deploy, managed PG/Redis, KEDA autoscaling on queue depth, read replicas + pgBouncer
- [ ] Analytics-driven optimization loop (feed performance back into strategy/prompts)
- [ ] Load test to real targets; DR + backup drills

## 4. Effort / complexity (T-shirt)
Phase 0 = S · Phase 1 = L · Phase 2 = XL · Phase 3 = XL. Total realistically 9–15 months at 2–3 engineers.

## 5. Top risks (see requirements report for full register)
1. Platform API access/quotas (existential) — validate MVP platforms' access FIRST.
2. AI/video cost blowup — meter + defer video.
3. Content moderation / brand-safety / legal liability — mandatory gate + approval.
4. Auto-vs-approval contradiction — resolve via per-brand trust tiers.
5. Scale-vs-effort mismatch — build for scale, load-test for reality.

## 6. Immediate next action
Answer the 8 questions → approve Phase 1 → I bootstrap the monorepo + infra skeleton (still no
business logic until scaffolding is reviewed).
