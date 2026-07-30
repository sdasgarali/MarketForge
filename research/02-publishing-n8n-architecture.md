# Publishing + n8n Orchestration Architecture

> Research report for the Enterprise AI Marketing Automation Platform (multi-brand, ~1,000 posts/day across YouTube, Instagram, Facebook, LinkedIn, X).
> Senior Automation/Integration Engineer perspective. All facts verified via web research current as of **July 2026**. Sources listed at the end.

---

## 0. Executive Summary (TL;DR)

| Decision | Recommendation |
|---|---|
| **MVP publishing** | **Ayrshare** (unified aggregator API) — one integration, all 5 platforms, per-brand "profiles", analytics included. Removes ~2–4 months of per-platform OAuth + app-review onboarding. |
| **Scale publishing** | **Hybrid**: keep Ayrshare (or self-hosted **Postiz** to kill per-profile fees) for IG/FB/LinkedIn/X; move **YouTube uploads to direct YouTube Data API v3** (upload cost collapsed to ~100 units in Dec 2025 and now bills to its own bucket — direct is cheap and gives full control). Isolate every platform behind an **adapter interface** so the aggregator is swappable per the prompt's design principle. |
| **Scheduler owner** | **Node/Express backend owns scheduling** via **BullMQ + Redis delayed jobs** (DB-driven from the `schedule` table). n8n does **not** own the clock. |
| **n8n role** | Integration glue only: publish-to-platform, generate-media, collect-analytics, error-handling. Runs in **queue mode** (main + N workers + Redis). Invoked by the backend via **webhook**, one execution per post. |
| **Biggest onboarding blockers** | (1) LinkedIn Community Management API 2-tier review + screencast + verified Company Page; (2) Meta (IG/FB) App Review + Business Verification for `instagram_content_publish` / `pages_manage_posts`; (3) X API is now **pay-per-use** ($0.015/post, $0.20 if it contains a link) — legacy Basic/Pro tiers are closed. An aggregator absorbs all three for MVP. |

---

## 1. Publishing Approach — Aggregator vs Direct APIs

### 1.1 The core trade-off

Building 5 direct platform integrations means 5 separate OAuth flows, 5 app-review processes (2 of which — Meta and LinkedIn — take weeks and can be rejected), 5 media-format handlers, 5 analytics schemas, and 5 rate-limit models. An **aggregator collapses that to one HTTP contract** and, critically, **inherits the platform app-review approvals** because you post through the aggregator's already-approved app.

For a platform that must onboard "hundreds of brands" fast, the aggregator is the correct MVP. The design-principle mandate ("make every publishing platform replaceable through adapters") means we wrap the aggregator behind a `PublisherAdapter` interface so we can later swap in direct APIs per-platform without touching business logic.

### 1.2 Option comparison (2026)

| Tool | Model | Platform coverage | Media (video/reels/carousel/YT) | Analytics | Multi-brand (multi-account) | Cost signal (2026) | Self-host |
|---|---|---|---|---|---|---|---|
| **Ayrshare** | API-first, bills **per active social profile** (a profile = one brand across all its networks) | 13+ incl. YouTube, IG, FB, LinkedIn, X, TikTok, Threads, Pinterest, Bluesky | Yes — YT upload (thumbnail, playlist, visibility, description), IG Reels/Stories/carousel, video optimization per platform | **Built-in** (views, likes, reach per post/profile) | **Native** — "User Profiles" API is designed for exactly this (one profile per brand) | Business ~**$599/mo for 30 profiles**, then $2.49–$8.99/extra profile; drops toward ~$1.99/profile at 500+ (annual) | No (SaaS) |
| **Postiz** (open source) | Self-host = free (server cost only); hosted plans too | Broad incl. Bluesky/Mastodon that others skip; official **REST API + MCP on every plan** | Yes | Yes | Yes (channels) | Self-host **free**; hosted $29–$99/mo (5–100 channels) | **Yes** — kills per-profile fees at scale |
| **Blotato** | AI content engine + posting API | Multi-network | Yes incl. faceless video gen | Yes | Yes | Cheaper per-API than Ayrshare (positioned as Ayrshare alternative) | No |
| **Publer** | Hosted scheduler, per-account | Broad | Yes | Yes | Yes | From **$5/mo**, per social account (multiplies) | No |
| **Buffer API** | Hosted scheduler | Mainstream networks | Limited video depth | Basic | Per channel | Legacy API, less "developer platform" than Ayrshare | No |
| **Metricool** | Analytics-first scheduler | Broad | Yes | **Strong analytics** | Yes | Per-brand tiers | No |
| **Direct platform APIs** | You own each integration | Full control, all features | Full native control | Native (richest) | You build it | Only platform API costs (e.g., X pay-per-use) — no aggregator markup | You own it |

### 1.3 Recommendation

- **MVP → Ayrshare.** One integration, all five required platforms, native multi-brand profiles, analytics retrieval included, YouTube video upload supported. Fastest path to "publish to 5 platforms across N brands" and it side-steps every platform app-review. Budget ~$599/mo to start (30 brands), scaling with brand count.
- **At scale (cost & control) → Hybrid:**
  1. **Self-host Postiz** to eliminate Ayrshare's per-profile fee once brand count makes the SaaS bill dominant (break-even is roughly when per-profile fees exceed a VPS + ops cost — typically a few hundred profiles). Postiz ships a REST API + MCP, so n8n can call it the same way.
  2. **Move YouTube to direct YouTube Data API v3** regardless of aggregator — the Dec 2025 quota change (below) makes direct YT uploads cheap and gives full metadata control (tags, playlists, community posts, Shorts).
  3. Keep every provider behind the `PublisherAdapter` so the swap is config, not code.

---

## 2. Per-Platform Constraints (2026)

| Platform | API surface | Key limit / cost (2026) | App review / access friction |
|---|---|---|---|
| **YouTube** | Data API v3 `videos.insert` | **Upload cost dropped from ~1,600 → ~100 units** (Dec 4, 2025, "16x reduction"). Default **10,000 units/day** project quota. Since **June 1, 2026**, uploads bill to a **separate ~100-calls/day bucket** — they no longer compete with reads/searches. Practically **~100 uploads/day per project**. | Google Cloud project + OAuth. **Audited quota extension** needed for >100 uploads/day/project — request more or shard across projects. Low review friction vs Meta/LinkedIn. |
| **Instagram** | Instagram Graph API (Business/Creator account, linked to FB Page) | **50 API-published posts / 24h per IG account** (hard cap). General API budget ~**200 calls/hour/user**, pooled across app users; 429 on breach. Content publishing has its own volume cap. | **Meta App Review** for `instagram_content_publish` + **Business Verification**. Weeks of friction. Aggregator inherits this. |
| **Facebook Pages** | Graph API (Pages) | Standard Graph rate limits (per-app + per-page pooled buckets); no hard "50/day" like IG but subject to app-level throttling. | **Meta App Review** for `pages_manage_posts`, `pages_read_engagement` + Business Verification. Same review as IG (shared Meta app). |
| **LinkedIn** | **Community Management API** (org-page posting) | Rate limits per app/org; posting to Company Pages is the canonical surface. | **Highest friction.** Requires registered company + **verified Page**, **two-tier app review** (Development → Standard), **Standard-tier request form + screencast** demonstrating each use case, and **Marketing Developer Platform partner review** to serve accounts you don't own. Dev tier expires in 12 months if not promoted. |
| **X (Twitter)** | X API v2 | **Pay-per-use is now default** for new devs (as of Feb 2026): **$0.015 / post created**, **$0.20 if the post contains a link**, $0.005/read (2M reads/mo cap). Legacy **$200 Basic / $5,000 Pro tiers closed to new signups**; free tier discontinued; existing Basic auto-migrating to pay-per-use since June 2026. | Developer account + app. The cost model (esp. the **$0.20 link penalty**) is the real "friction" — 1,000 link posts/day ≈ **$6,000/mo**. Budget carefully; prefer link-in-bio / non-link posts where possible. |

**Onboarding-friction ranking (worst → best):** LinkedIn (2-tier review + screencast) → Meta IG/FB (app review + business verification) → X (no review, but pay-per-use cost model) → YouTube (Cloud project + optional quota audit). **This ordering is the single strongest argument for launching on an aggregator.**

---

## 3. n8n at Scale

### 3.1 Queue mode (mandatory at 1k posts/day)

Single-process (`main`) mode cannot sustain concurrent publishing + media generation. Run **queue mode**:

- `EXECUTIONS_MODE=queue`
- **Main instance**: UI, REST/public API, webhook ingestion, scheduling triggers — writes jobs to Redis. Do **not** run heavy work here.
- **Redis**: the job broker (pending executions wait here).
- **PostgreSQL**: shared execution DB (SQLite is **not supported** in queue mode).
- **Workers**: `n8n worker` processes that pull jobs from Redis and execute. **Scale horizontally** by adding workers (Docker Compose `--scale`, or K8s replicas). Per-worker concurrency via the `--concurrency` flag.
- **Webhook processors** (optional): dedicated instances to absorb inbound webhook bursts separately from workers.

**Capacity math (rule of thumb):** 1,000 posts/day ≈ 42/hour ≈ <1/minute average, but campaigns spike. With workers at `--concurrency=10`, even 2–4 workers give 20–40 concurrent publishes — ample headroom. Media generation (image/video) is the real load driver; give it its own workers/queue lane so a slow Veo render never starves publishing.

### 3.2 Why modular sub-workflows beat one monolith

A single giant workflow becomes a **single point of cascading failure** — one bug (infinite loop, pagination bug, webhook storm) can take down every brand's publishing because they share the same workers/DB/memory. The prompt's own design principle mandates modularity. Benefits:

- **Blast-radius isolation** — a broken `wf-publish-linkedin` doesn't stop `wf-publish-youtube`.
- **Independent versioning & testing** per platform.
- **Reuse** — `wf-error-handler`, `wf-collect-analytics` called by many flows.
- **Parallelism** — the orchestrator fans out platform publishes concurrently.

Compose with the **Execute Workflow** node: a thin **orchestrator** receives one post job and calls the correct `wf-publish-<platform>` sub-workflow (and `wf-generate-*` beforehand). Pass minimal typed payloads (postId, brandId, platform, assetRefs) — never bulk data.

### 3.3 Error handling, retries, idempotency

- **Error Workflow setting** → point every production workflow at a dedicated `wf-error-handler` containing an **Error Trigger** node. Central place to log to Postgres, alert (Slack/Telegram/email per prompt), and mark the post `failed`.
- **Retries with exponential backoff + jitter**: 3–5 attempts, e.g. **1s, 2s, 5s, 13s ±20% jitter**. Exponential backoff has been shown to cut API failures ~89% vs fixed intervals. Respect **429** with `Retry-After`; reduce concurrency on repeated 429s.
- **Idempotency**: the backend passes a unique `jobId`/`idempotencyKey`; n8n (or the backend on callback) checks whether that post already has a platform post-ID before re-publishing — prevents double-posts on retry.

### 3.4 Webhook vs polling

- **Backend → n8n = webhook** (push). The scheduler fires exactly when due; no polling latency.
- **Analytics = polling** (n8n Schedule Trigger or backend-triggered) because platforms don't push analytics — see §5.
- Prefer webhooks everywhere a push exists; poll only where the platform forces it.

### 3.5 n8n public API + per-brand credentials

- The **n8n public REST API** lets the backend programmatically create/activate workflows, trigger executions, and (on self-hosted) **manage credentials** — useful for provisioning a new brand's workflow set from the dashboard. Guard the API key; scope it.
- **Per-brand credential strategy (recommended):** **do NOT create one n8n credential per brand** (thousands of credentials is unmanageable and the public API's credential handling is limited). Instead:
  - With an **aggregator**: n8n holds **one** aggregator credential; the **brand's identity is a parameter** (Ayrshare `profileKey` / Postiz channel). Per-brand secrets live in the **backend DB, encrypted**, and are passed into the execution payload. This is the clean, scalable pattern.
  - With **direct APIs**: store each brand's OAuth tokens **encrypted in the backend DB**, inject the access token into the n8n execution at call time (HTTP Request node with header auth from payload). n8n stays stateless w.r.t. brand secrets; the backend is the source of truth and handles token refresh.

### 3.6 The n8n ↔ Backend boundary (define it explicitly)

| Concern | Owner |
|---|---|
| Business logic, RBAC, multi-tenancy, DB writes/reads | **Backend (Node/Express)** |
| Scheduling clock, job queue, retries at the job level, idempotency keys | **Backend (BullMQ/Redis)** |
| Brand config, credentials (encrypted), analytics storage | **Backend (Postgres)** |
| Approval workflow, quality gating (<90 regenerate) | **Backend** (n8n may call the review sub-workflows, decision recorded in backend) |
| Calling external platform/AI/media APIs (the "glue") | **n8n workflows** |
| Media generation orchestration (image/video/voiceover) | **n8n sub-workflows**, results written back to backend/Drive |
| Publishing execution + capturing platform post-ID/URL | **n8n**, result POSTed back to backend |

**One sentence:** *the backend decides **what** to do and **when**; n8n does the **integration doing** and reports results back.*

---

## 4. Scheduling Engine

### 4.1 DB-driven backend scheduler (recommended) vs n8n Schedule Triggers

| Approach | Verdict |
|---|---|
| **n8n Schedule Trigger per campaign** | ❌ Doesn't scale to thousands of per-post times across brands/timezones; the prompt explicitly bans hardcoded schedules; hard to query/retry/audit. |
| **Backend-owned scheduler (BullMQ delayed jobs on Redis)** | ✅ **Recommended.** The `schedule` table (Campaign, Brand, Platform, Date, Time, Timezone, Priority, Status, RetryCount, Approval flags, Generated/Published/AnalyticsSynced) is the source of truth; a scheduler service enqueues **BullMQ delayed jobs** at the correct instant; on fire, the backend calls n8n via webhook. |

### 4.2 How it works

1. Post row created (`status=scheduled`) with a UTC instant computed from `time` + `timezone`.
2. Scheduler enqueues a **BullMQ delayed job** (`delay = runAtUTC - now`). For far-future posts, a sweeper promotes rows into BullMQ within a rolling window (e.g., next 24–48h) so Redis isn't holding millions of far-future jobs.
3. On job fire → guard checks (`approved`, `generated`, not already `published`) → **webhook to n8n orchestrator**.
4. n8n publishes, POSTs the platform `postId`/`url`/`timestamp` back → backend sets `status=published`.
5. Failure → n8n `wf-error-handler` notifies backend; backend increments `RetryCount` and re-enqueues with backoff, or marks `failed` after max retries.

### 4.3 Timezone, retries, idempotency

- **Timezone:** store the brand/campaign IANA timezone (e.g., `Asia/Karachi`); compute the **absolute UTC** fire instant once, at enqueue time, using a TZ-aware library (Luxon/date-fns-tz). Store both the local intent and the resolved UTC. Handle DST by resolving at enqueue, not at author time.
- **Retries:** `RetryCount` column + BullMQ `attempts` with `backoff: { type: 'exponential' }`. Cap at 3–5; then `failed` + alert.
- **Idempotency:** BullMQ `jobId = postId` (dedupe — a post can't be enqueued twice); n8n checks for an existing platform post-ID before publishing; the publish result callback is upsert-by-postId.

---

## 5. Analytics Collection

### 5.1 How

- **Via aggregator (MVP):** Ayrshare returns per-post and per-profile analytics (views, likes, reach, engagement) through its API — one schema, all platforms. Simplest.
- **Via native (scale/richer):** call each platform's insights endpoint (YouTube Analytics API, IG/FB Insights, LinkedIn Org Page statistics, X metrics). Richer (watch time, CTR, demographics) but 4–5 schemas to normalize.

### 5.2 Polling cadence (analytics is pull, not push)

| Age of post | Cadence |
|---|---|
| 0–24h | every 1–3h (early velocity matters most) |
| 1–7 days | every 6–12h |
| 7–30 days | daily |
| >30 days | weekly, then stop |

Run via `wf-collect-analytics` (n8n Schedule Trigger, or backend-enqueued sweep). **Mind rate limits** — IG's ~200 calls/hr budget means batch and stagger analytics pulls across brands so they don't collide with publishing.

### 5.3 Storage

- Postgres time-series table: `post_analytics(post_id, platform, metric, value, collected_at)` (append-only snapshots so you can chart growth over time), plus a `post_analytics_latest` materialized view for dashboards.
- Set `analytics_synced=true` on the schedule row after each successful pull; feed aggregates back to the Performance Optimizer / Prompt Optimizer agents to close the "improve future content" loop.

---

## 6. Modular n8n Workflow Map

**Orchestrator invokes sub-workflows via the Execute Workflow node; each sub-workflow has its own Error Workflow → `wf-error-handler`.**

```
                         ┌─────────────────────────────┐
  Backend (BullMQ fire)  │  wf-orchestrator (webhook)  │
  ── webhook ──────────► │  routes by stage + platform │
                         └──────────────┬──────────────┘
              ┌───────────────┬─────────┼───────────┬──────────────┐
              ▼               ▼         ▼             ▼              ▼
      wf-generate-image  wf-generate-video  wf-generate-voiceover  wf-review-gate
      (Flux/SDXL/…)      (Veo/Kling/…)      (TTS)                  (grammar/brand/…)
              └───────────────┴─────────┬───────────┴──────────────┘
                                        ▼ (assets ready + approved)
                         ┌──────────────────────────────┐
                         │   publish fan-out (parallel)  │
                         └───┬────┬────┬────┬────┬───────┘
                             ▼    ▼    ▼    ▼    ▼
        wf-publish-youtube  wf-publish-instagram  wf-publish-facebook
        wf-publish-linkedin wf-publish-x
                             │
                             ▼ (post_id/url/timestamp → POST back to backend)
        ── later, on schedule ──►  wf-collect-analytics  ──► backend

  Cross-cutting: wf-error-handler (Error Trigger; logs + notifies + marks failed)
                 wf-notify (Slack/Telegram/Discord/Email/dashboard)
```

### Sub-workflow inventory

| Workflow | Trigger | Responsibility |
|---|---|---|
| `wf-orchestrator` | Webhook (from backend) | Validate payload, sequence generate → review → publish, fan out by platform |
| `wf-generate-image` | Execute Workflow | Call image model adapter (Flux/SDXL/Ideogram/GPT-Image/ComfyUI), save to Drive, return refs |
| `wf-generate-video` | Execute Workflow | Call video model adapter (Veo/Kling/Runway/…), handle async render polling, save |
| `wf-generate-voiceover` | Execute Workflow | TTS + subtitles, save |
| `wf-review-gate` | Execute Workflow | Grammar/fact/brand/SEO/policy checks; return score; <90 → signal regenerate |
| `wf-publish-youtube` | Execute Workflow | Aggregator or direct YT Data API upload; capture videoId/URL |
| `wf-publish-instagram` | Execute Workflow | Reels/Stories/carousel publish; capture media_id |
| `wf-publish-facebook` | Execute Workflow | Page post/reel; capture post_id |
| `wf-publish-linkedin` | Execute Workflow | Org-page post via Community Management API / aggregator |
| `wf-publish-x` | Execute Workflow | Post/thread; capture tweet_id (watch $0.20 link cost) |
| `wf-collect-analytics` | Schedule Trigger / backend sweep | Pull metrics per active post at cadence in §5.2; write back |
| `wf-error-handler` | Error Trigger | Central logging, alerting, mark `failed`, hand back to backend for retry |
| `wf-notify` | Execute Workflow / webhook | Multi-channel notifications (success/failure/approval requests) |

**Publisher adapter principle:** each `wf-publish-*` is a thin wrapper over a single `PublisherAdapter` HTTP contract. Swapping Ayrshare → Postiz → direct API changes only the credential/endpoint config, not the orchestrator — satisfying "make every publishing platform replaceable through adapters."

---

## Sources

- [Ayrshare Pricing](https://www.ayrshare.com/pricing/) · [Ayrshare API Overview](https://www.ayrshare.com/docs/apis/overview) · [Ayrshare YouTube video posting](https://www.ayrshare.com/blog/ayrshare-api-posting-videos-to-youtube/) · [Capterra: Ayrshare 2026](https://www.capterra.com/p/213297/Ayrshare/)
- [Blotato: YouTube API Pricing 2026](https://www.blotato.com/blog/youtube-api-pricing) · [Phyllo: YouTube API Limits 2026](https://www.getphyllo.com/post/youtube-api-limits-how-to-calculate-api-usage-cost-and-fix-exceeded-api-quota) · [SocialCrawl: YouTube Data API 2026](https://www.socialcrawl.dev/blog/youtube-data-api-2026)
- [Phyllo: Instagram API Rate Limits 2026](https://www.getphyllo.com/post/instagram-api-rate-limits-explained----and-how-to-scale-beyond-them-2026) · [Netrows: Instagram Graph API 2026](https://www.netrows.com/blog/instagram-graph-api-guide-2026)
- [LinkedIn: Increasing Access (MS Learn)](https://learn.microsoft.com/en-us/linkedin/marketing/increasing-access?view=li-lms-2026-01) · [LinkedIn: Community Management App Review](https://learn.microsoft.com/en-us/linkedin/marketing/community-management-app-review?view=li-lms-2026-06) · [LinkedIn Community Management API Access (2026)](https://singhamandeep.com/linkedin-community-management-api-access/)
- [twitterapi.io: X API Cost 2026](https://twitterapi.io/blog/x-api-cost-breakdown-2026) · [Blotato: X API Pricing 2026](https://www.blotato.com/blog/twitter-api-pricing) · [Postproxy: X API Pricing 2026](https://postproxy.dev/blog/x-api-pricing-2026/)
- [Blotato: Ayrshare Alternatives 2026](https://www.blotato.com/blog/ayrshare-alternatives) · [Postiz: free social scheduling API with n8n](https://postiz.com/blog/free-social-media-scheduling-api-n8n-postiz-buffer-blotato-alternative)
- [n8n Docs: Queue Mode](https://docs.n8n.io/hosting/scaling/queue-mode/) · [n8n Docs: Concurrency Control](https://docs.n8n.io/hosting/scaling/concurrency-control/) · [n8n Docs: Error Handling](https://docs.n8n.io/flow-logic/error-handling/) · [NextGrowth: n8n Error Alerts 2026](https://nextgrowth.ai/n8n-workflow-error-alerts-guide/) · [Wednesday: Advanced n8n Error Handling](https://www.wednesday.is/writing-articles/advanced-n8n-error-handling-and-recovery-strategies)
