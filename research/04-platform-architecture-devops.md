# 04 — Platform Architecture & DevOps

**Enterprise Multi-Brand AI Marketing Automation SaaS**
**Role:** Senior Software Architect + DevOps Engineer
**Date:** 2026-07-30
**Scope targets:** 500+ companies (brands), 10,000+ generated assets/day, 1,000+ scheduled posts/day, concurrent workflow execution, horizontal scaling.

> This document is the authoritative architecture & infrastructure design. Tech-stack choices below were **verified against current-as-of-2026 sources** (Next.js 16.2.7, BullMQ 5.71, PostgreSQL RLS multi-tenancy guidance, Clerk/Better Auth org primitives, Google Drive May-2026 quota model). Citations are listed at the end.

---

## 0. Executive Summary (decisions up front)

| Concern | Decision | One-line rationale |
|---|---|---|
| Multi-tenancy | **Shared-schema + `org_id` on every table + PostgreSQL RLS** | 2026 default for 100–10k tenants; DB-enforced isolation as a safety net behind app scoping. |
| Auth | **Clerk** (primary rec) with **Better Auth** as the self-hosted fallback | Clerk ships a first-class Organizations + roles primitive; saves 2–4 weeks of B2B glue. |
| Service topology | web (Next.js) → API (Express) → BullMQ workers → n8n → Postgres/Redis/object-store | Clean separation of orchestration, generation, review, publishing, analytics. |
| Repo | **pnpm workspaces + Turborepo monorepo** | Shared TS types/contracts across web/api/workers; single CI graph. |
| Storage | **Storage adapter** with S3-compatible primary; **Google Drive as a mirror/deliverable target** | Drive's ~3 writes/sec/account cap cannot sustain 10k assets/day as the hot path. |
| Queues | BullMQ, **one queue per job type**, rate-limited, priorities, retries + DLQ, FlowProducer for DAGs | Prevents slow LLM/video jobs from starving fast validation jobs. |
| Deploy | Docker Compose (dev) → **Kubernetes with HPA** (prod) | Single Hostinger VPS is fine for dev/pilot; target scale needs a cluster + managed Postgres/Redis. |

**Top infra/scale caveat:** *Google Drive as a primary hot store is a hard bottleneck* — Google caps sustained writes at ~3 requests/sec/account and (as of May 2026) meters usage as a shared quota-unit pool. 10k assets/day (~0.12/sec average, but bursty) will exceed per-account write limits during campaign bursts. Use S3-compatible object storage as the system of record and treat Drive as an async, rate-limited, per-brand **mirror**.

---

## 1. High-Level Architecture

### 1.1 Service boundaries

```
                                   ┌────────────────────────────────────────────┐
                                   │                 CLIENTS                     │
                                   │   Browser (dashboard)  ·  Webhooks in       │
                                   └───────────────┬────────────────────────────┘
                                                   │ HTTPS
                                       ┌───────────▼───────────┐
                                       │   Ingress / Nginx     │  TLS, WAF, rate-limit
                                       └─────┬───────────┬─────┘
                             ┌───────────────┘           └───────────────┐
                             ▼                                           ▼
              ┌──────────────────────────┐               ┌───────────────────────────┐
              │  WEB  (Next.js 16, SSR)  │  REST/tRPC    │   API  (Express + TS)     │
              │  ShadCN/Tailwind/RQuery  │──────────────▶│  Domain services (DDD)    │
              │  Zustand · Framer Motion │◀──────────────│  AuthZ guard · RLS ctx    │
              └──────────────────────────┘   SSE/WS      └───┬───────────┬───────────┘
                                                             │ enqueue   │ trigger
                                          ┌──────────────────▼──┐   ┌────▼─────────────────┐
                                          │   Redis  (BullMQ)   │   │   n8n (self-hosted)  │
                                          │  queues · cache ·   │   │  queue-mode workers  │
                                          │  rate-limit · locks │   │  research/publish    │
                                          └──────┬──────────────┘   │  platform adapters   │
                                                 │ consume          └────┬─────────────────┘
                    ┌────────────────────────────▼───────────────┐       │ callbacks (webhook)
                    │  WORKERS (BullMQ consumers, stateless)      │◀──────┘
                    │  research · generate-text · image · video  │
                    │  review · publish · analytics · notify     │
                    │  → call AI/image/video adapters + n8n       │
                    └───────┬───────────────────┬────────────────┘
                            │ read/write         │ read/write
                 ┌──────────▼─────────┐   ┌──────▼────────────────────────────┐
                 │ PostgreSQL (RLS)   │   │  Object Storage (system of record) │
                 │ primary + replicas │   │  S3-compatible (MinIO/R2/S3)       │
                 │ pgBouncer pool     │   │      │ async mirror (rate-limited)  │
                 └────────────────────┘   │      ▼                             │
                                          │  Google Drive (per-brand tree)     │
                                          └────────────────────────────────────┘

  Cross-cutting: OpenTelemetry traces → Tempo/Jaeger · Prometheus metrics → Grafana ·
                 Sentry errors · structured JSON logs → Loki · Secrets via KMS/Vault
```

### 1.2 How the services interact (request/data flow)

1. **Browser → Web (Next.js 16, App Router).** Server Components render the shell; React Query hydrates data; Zustand holds ephemeral UI state; Framer Motion handles transitions. The web tier calls the API over REST/tRPC and never talks to Postgres directly.
2. **Web → API (Express).** Every request carries the Clerk session JWT. API middleware verifies the token, resolves `org_id` + role, and **sets the Postgres RLS session variable** (`SET LOCAL app.current_org = …`) inside the request transaction. All domain logic lives here (DDD services: `BrandService`, `CampaignService`, `ContentService`, `PublishingService`, `AnalyticsService`).
3. **API → Redis/BullMQ.** Long-running work (research, generation, review, publish, analytics sync) is **never** done in the request. The API enqueues jobs (with `org_id` + `brand_id` in the payload) and returns `202 Accepted` with a job id. Progress is streamed back to the browser via SSE/WebSocket bridged from BullMQ events.
4. **Workers.** Stateless BullMQ consumers pull jobs, call the relevant **adapter** (AI provider / image / video / publishing) or **hand off to n8n** for integration-heavy steps, write results to Postgres + object storage, and emit progress/cost/token events.
5. **n8n (integration engine).** Runs in **queue mode** (own Redis + Postgres) for the messy external-integration parts: trend research (Google Trends, Reddit, X, LinkedIn scraping), social publishing, and analytics polling. Kept **modular** — many small workflows invoked by the workers via webhook, not one monolith. n8n calls back into the API via signed webhooks on completion.
6. **Storage.** Workers write the canonical artifact to S3-compatible storage first (fast, unlimited throughput), then enqueue a low-priority `drive-mirror` job that copies to the brand's Google Drive tree under the API's per-account rate limit.
7. **Observability sidecar path.** Every service emits OTel spans, Prometheus metrics, and structured logs; per-agent token/cost is recorded per job.

### 1.3 Monorepo layout (pnpm + Turborepo)

- **`apps/`** — deployable units: `web`, `api`, `workers`, `n8n` (config/workflows).
- **`packages/`** — shared code: `db` (schema, migrations, RLS policies), `contracts` (zod + TS types shared by web/api/workers), `adapters` (ai/image/video/storage/social), `queue` (BullMQ definitions), `config`, `logger`, `auth`, `ui` (ShadCN component library).
- Turborepo caches lint/typecheck/test/build across the graph; changed-package-only CI.

---

## 2. Multi-Tenancy

### 2.1 Options compared (for 500+ brands)

| Model | Isolation | Ops cost | Migrations | Scale ceiling | Verdict |
|---|---|---|---|---|---|
| **Shared schema + `org_id`** (row-level) | Logical (app + RLS) | **Lowest** | **One centralized set** | 10k+ tenants before sharding | **Recommended** |
| Schema-per-tenant | Stronger (namespace) | High (N schemas to migrate) | Per-schema fan-out | Hundreds–low thousands of schemas before catalog bloat | Only for enterprise tenants needing customization |
| DB-per-tenant | Strongest (physical) | Highest (N clusters, N backups) | Per-DB fan-out | Limited by infra/cost | Only for compliance/enterprise carve-outs |

### 2.2 Recommendation: **Shared schema + `org_id` + PostgreSQL Row-Level Security**

This is the 2026 consensus default for B2B SaaS in the 100–10,000-tenant band with SOC-2-class (not per-tenant physical isolation) requirements. Rationale:

- **500 brands is small** for row-level; a single well-indexed Postgres handles it comfortably with room to grow.
- **One migration path**, one backup, one connection pool — critical for a small team operating at agency scale.
- **Defense in depth:** app-level scoping *plus* RLS means that even if a developer forgets a `WHERE org_id = …`, the database still filters rows. The single biggest failure mode of the `tenant_id` pattern (a forgotten filter leaking cross-tenant data) is closed by RLS.
- **Escape hatch:** when a marquee client demands physical isolation, promote *that one* org to a dedicated DB/schema behind the same storage adapter — hybrid, not big-bang.

### 2.3 Isolation-enforcement strategy (mandatory)

1. **Every tenant-owned table carries `org_id UUID NOT NULL`** and a composite index leading with `org_id`.
2. **RLS enabled + FORCE** on every tenant table:
   ```sql
   ALTER TABLE brands ENABLE ROW LEVEL SECURITY;
   ALTER TABLE brands FORCE ROW LEVEL SECURITY;
   CREATE POLICY org_isolation ON brands
     USING (org_id = current_setting('app.current_org')::uuid)
     WITH CHECK (org_id = current_setting('app.current_org')::uuid);
   ```
3. **Request-scoped tenant context.** A single guard middleware runs on *every* authenticated request: verify JWT → resolve `org_id`/role → open a transaction → `SET LOCAL app.current_org = <org_id>` and `SET LOCAL app.current_role = <role>`. The app DB role is **non-superuser** and **non-BYPASSRLS**, so policies always apply.
4. **Workers set the same context** from the job payload's `org_id` before any query — jobs are as tenant-scoped as HTTP requests.
5. **Repository layer forbids raw pool access** — all queries go through a `TenantDb` wrapper that guarantees the session variable is set; a lint rule + the `multi-tenant-isolation-auditor` agent block PRs that query outside it.
6. **Cross-tenant admin operations** use an explicit, audited `SET app.current_org = ...` per target org, never a blanket bypass.

---

## 3. Data Model (core PostgreSQL schema)

Pragmatic, normalized where it matters, JSONB where the shape is fluid (brand profile extras, agent config, analytics blobs). All tenant tables carry `org_id` + timestamps; omitted below for brevity except where load-bearing.

```sql
-- ========== TENANCY & IDENTITY ==========
organizations (              -- the tenant (an agency or company account)
  id uuid pk, name text, slug text unique, plan text,
  clerk_org_id text unique,  -- link to Clerk org
  status text, settings jsonb, created_at, updated_at )

users (
  id uuid pk, clerk_user_id text unique, email citext unique,
  full_name text, avatar_url text, last_login_at, created_at )

org_memberships (            -- user↔org N:N with a role (multi-org users)
  id uuid pk, org_id uuid fk→organizations, user_id uuid fk→users,
  role text check in ('admin','manager','editor','viewer'),
  invited_by uuid, status text, created_at,
  unique(org_id, user_id) )

roles (                      -- optional: custom role definitions per org
  id uuid pk, org_id uuid, name text, permissions jsonb )

-- ========== BRANDS (multi-brand core) ==========
brands (
  id uuid pk, org_id uuid fk→organizations,
  company_name text, website text, industry text,
  products jsonb, services jsonb,          -- lists
  mission text, vision text,
  target_audience jsonb, competitors jsonb,
  logo_asset_id uuid fk→assets,
  brand_colors jsonb,                       -- {primary,secondary,accent,...}
  fonts jsonb, icons jsonb,
  brand_voice text, writing_style text, preferred_cta text,
  negative_prompt text, image_style text, video_style text,
  approved_characters jsonb,                -- character presets
  timezone text, languages text[],          -- e.g. ['en','ur','ar']
  drive_folder_id text,                     -- root Drive folder for the brand
  publishing_schedule jsonb,                -- default cadence
  approval_settings jsonb,                  -- {mode:'auto'|'manual', min_score:90}
  knowledge_base jsonb,                      -- crawled site facts / FAQs
  status text, created_at, updated_at,
  index(org_id) )

brand_social_accounts (      -- was social_accounts, brand-scoped
  id uuid pk, org_id uuid, brand_id uuid fk→brands,
  platform text check in ('youtube','instagram','facebook','linkedin','x','tiktok'),
  handle text, external_account_id text,
  credentials_ref uuid fk→secrets,          -- encrypted token pointer, never inline
  connection_status text, connected_at, expires_at )

-- ========== CAMPAIGNS & SCHEDULING ==========
campaigns (
  id uuid pk, org_id uuid, brand_id uuid fk→brands,
  name text, campaign_type text,            -- one-time|recurring|holiday|launch|emergency
  platform text, topic text, priority int,
  language text, timezone text,
  schedule jsonb,                            -- rrule/cron for recurring
  run_at timestamptz, status text,           -- draft|queued|running|paused|done|failed
  retry_count int default 0,
  approval_required bool default true,
  auto_mode bool default false,
  created_by uuid, created_at, updated_at,
  index(org_id, brand_id, status, run_at) )

-- ========== CONTENT & ASSETS ==========
content_items (
  id uuid pk, org_id uuid, brand_id uuid, campaign_id uuid fk→campaigns,
  platform text, content_type text,          -- post|reel|short|thread|carousel|article
  language text,
  title text, body text, caption text, hashtags text[],
  metadata jsonb,                            -- platform-specific fields (tags, cta, poll...)
  status text,                               -- generating|review|approved|rejected|scheduled|published|failed
  quality_score numeric,                     -- from review pipeline
  parent_id uuid fk→content_items,           -- variants/versions
  version int default 1,
  generated_at, created_at, updated_at,
  index(org_id, brand_id, campaign_id, status) )

assets (                     -- images/video/gif/audio/subtitle files
  id uuid pk, org_id uuid, brand_id uuid,
  content_item_id uuid fk→content_items,
  kind text check in ('image','video','gif','audio','subtitle','thumbnail','doc'),
  storage_key text,                          -- canonical S3 key
  drive_file_id text,                        -- mirror location (nullable until mirrored)
  mime_type text, bytes bigint,
  width int, height int, duration_ms int,
  checksum text, model text,                 -- generator model used
  status text, created_at,
  index(org_id, brand_id, kind) )

-- ========== RESEARCH ==========
research_reports (
  id uuid pk, org_id uuid, brand_id uuid, campaign_id uuid,
  sources jsonb,                             -- trends/news/reddit/x/linkedin/competitors...
  summary text, keywords text[], hashtags text[],
  hooks jsonb, pain_points jsonb, search_intent jsonb,
  raw jsonb, created_by_agent text, created_at )

-- ========== REVIEW / QA ==========
review_results (
  id uuid pk, org_id uuid, content_item_id uuid fk→content_items,
  stage text,                                -- grammar|fact|brand|copyright|seo|visual|marketing|policy|duplicate|accessibility
  agent text, score numeric, passed bool,
  findings jsonb, model text, tokens int, cost_usd numeric,
  created_at,
  index(org_id, content_item_id, stage) )

-- ========== PUBLISHING ==========
publish_jobs (
  id uuid pk, org_id uuid, brand_id uuid,
  content_item_id uuid fk→content_items,
  social_account_id uuid fk→brand_social_accounts,
  platform text, scheduled_at timestamptz,
  status text,                               -- pending|publishing|published|failed|cancelled
  retry_count int default 0, max_retries int default 5,
  external_post_id text, post_url text, published_at timestamptz,
  error jsonb, bullmq_job_id text,
  index(org_id, status, scheduled_at) )

-- ========== ANALYTICS ==========
analytics (
  id uuid pk, org_id uuid, brand_id uuid,
  content_item_id uuid, publish_job_id uuid, platform text,
  captured_at timestamptz,
  views bigint, reach bigint, impressions bigint, watch_time_ms bigint,
  clicks bigint, ctr numeric, comments bigint, likes bigint, shares bigint,
  followers_delta bigint, engagement_rate numeric, conversions bigint,
  raw jsonb,
  index(org_id, brand_id, platform, captured_at) )

-- ========== PROMPTS & AGENTS ==========
prompt_templates (
  id uuid pk, org_id uuid nullable,          -- null = global template
  brand_id uuid nullable, name text, agent_type text,
  version int, body text, variables jsonb, is_active bool,
  created_by, created_at )

ai_agents (                  -- per-org/brand agent config (DB-driven, not hardcoded)
  id uuid pk, org_id uuid, brand_id uuid nullable,
  agent_type text,                           -- research|copywriter|brand_compliance|...
  provider text, model text, params jsonb,   -- temp, max_tokens, provider routing
  fallback_chain jsonb,                       -- ordered provider fallbacks
  enabled bool, created_at, updated_at )

-- ========== SECRETS / API KEYS ==========
secrets (                    -- envelope-encrypted; app never stores plaintext
  id uuid pk, org_id uuid, brand_id uuid nullable,
  kind text,                                 -- openai|anthropic|social_token|drive|s3...
  label text,
  ciphertext bytea, iv bytea, auth_tag bytea, -- AES-256-GCM
  dek_wrapped bytea, kek_id text,             -- envelope: wrapped data key + KEK ref
  rotated_at, expires_at, created_at )

api_keys (                   -- inbound platform API keys (for the SaaS's own API)
  id uuid pk, org_id uuid, name text, hashed_key text, prefix text,
  scopes text[], last_used_at, revoked_at, created_at )

-- ========== AUDIT / NOTIFY / BILLING ==========
audit_logs (
  id bigint pk, org_id uuid, actor_user_id uuid, actor_type text,
  action text, entity_type text, entity_id uuid,
  before jsonb, after jsonb, ip inet, user_agent text, created_at,
  index(org_id, created_at) )

execution_logs (             -- per-agent/job run log (prompt/model/tokens/cost)
  id bigint pk, org_id uuid, brand_id uuid, campaign_id uuid,
  workflow text, agent text, prompt_template_id uuid,
  provider text, model text, exec_ms int,
  input_tokens int, output_tokens int, cost_usd numeric,
  status text, error jsonb, output_version int, created_at,
  index(org_id, created_at) )

notifications (
  id uuid pk, org_id uuid, user_id uuid nullable,
  channel text,                              -- email|slack|discord|telegram|dashboard
  type text,                                 -- success|failure|warning|approval|queue_status
  title text, body text, payload jsonb,
  read_at, sent_at, created_at )

billing_accounts (
  id uuid pk, org_id uuid unique, plan text, seats int,
  usage_metered jsonb, external_customer_id text,  -- Stripe id
  current_period_start, current_period_end, status text )

usage_records (              -- metered AI/asset usage for billing + cost caps
  id bigint pk, org_id uuid, metric text, quantity numeric,
  cost_usd numeric, occurred_at, index(org_id, metric, occurred_at) )
```

**Key relations:** `organizations 1─N brands 1─N {campaigns, brand_social_accounts, assets}`; `campaigns 1─N content_items 1─N {assets, review_results, publish_jobs}`; `publish_jobs 1─N analytics`. Everything hangs off `org_id` for RLS.

---

## 4. Auth & RBAC

### 4.1 Clerk vs Auth.js (for B2B multi-tenant with Admin/Manager/Editor/Viewer)

| Dimension | **Clerk** | **Auth.js (NextAuth)** | **Better Auth** (Auth.js successor) |
|---|---|---|---|
| Organizations primitive | **Built-in** (orgs, members, invites, per-org roles) | None — build it yourself (2–4 wks glue) | **Org plugin** (orgs/members/invites/roles) |
| Roles/permissions | Built-in org roles + permissions | DIY in DB + middleware | Built-in RBAC |
| Hosting / data ownership | Managed (vendor lock-in) | Self-host, own the data | Self-host, own the data |
| Pre-built UI | Rich (`<OrganizationSwitcher/>`, etc.) | None | Minimal |
| Cost | Per-MAU pricing | Free | Free |
| Time-to-market | **Fastest** | Slowest | Fast |

### 4.2 Recommendation: **Clerk** (primary), **Better Auth** as the exit strategy

For an agency SaaS whose differentiator is the AI pipeline (not auth), Clerk's Organizations primitive maps 1:1 onto our `organizations` + `org_memberships` model and delivers org switching, invitations, and the four roles out of the box — removing weeks of undifferentiated work. We **mirror** Clerk orgs/users into Postgres (`clerk_org_id`, `clerk_user_id`) so all authorization and RLS run off our own tables and are never dependent on a network call to Clerk in the hot path.

**Migration insurance:** if per-MAU cost or lock-in becomes painful at 500+ orgs, **Better Auth** (which now maintains Auth.js and offers an equivalent org/RBAC plugin, self-hosted) is the pre-planned migration target. Keeping auth behind a thin `packages/auth` adapter makes the swap contained.

**RBAC enforcement:** roles resolve to a permission set; a single `authorize(permission)` guard runs in the API after tenant context is set. Roles: **Admin** (org + billing + users + everything), **Manager** (campaigns/brands/publishing, no billing/user-admin), **Editor** (create/edit content, submit for approval), **Viewer** (read-only). RBAC is enforced in the API layer *and* reflected in RLS `WITH CHECK` for write paths.

### 4.3 Secrets encryption at rest (per-brand API keys) & key management

- **Envelope encryption.** Each secret gets a random **256-bit DEK**; the payload is encrypted **AES-256-GCM** (unique IV + auth tag per row). The DEK is **wrapped by a KEK** held in a KMS (AWS KMS / GCP KMS / HashiCorp Vault Transit). Only the wrapped DEK + `kek_id` are stored in `secrets`; plaintext keys never touch the DB or logs.
- **KEK rotation** without re-encrypting all data: rewrap DEKs on rotation; `kek_id` records which KEK version wrapped each DEK.
- **Access path:** only the API/worker runtime, holding the KMS decrypt permission, can unwrap. Secrets are decrypted just-in-time in memory for a single adapter call and never returned to the browser.
- **Inbound keys** (the SaaS's own API keys in `api_keys`) are stored **hashed** (Argon2/SHA-256 + prefix), compared on use — never recoverable.

---

## 5. Storage

### 5.1 Google Drive as primary — the honest constraint

The prompt names Google Drive as primary. **Do not make it the hot write path.** Verified 2026 limits:

- **Sustained writes capped at ~3 insert/write requests per second per account** — Google states this rate *cannot be increased*.
- As of **May 1, 2026**, Drive meters usage as a **shared quota-unit pool** (a list ≈ 100 units, a download ≈ 200 units); new projects get 12,000 queries/60s, legacy projects keep ~20,000 calls/100s pending rollout.
- At 10k assets/day the *average* is ~0.12 writes/sec, but generation is **bursty** (a campaign fan-out can emit hundreds of assets in minutes), which will hit the 3/sec ceiling and add multi-second latency.

### 5.2 Recommendation: **Storage adapter, S3-compatible primary, Drive as per-brand mirror**

- **`StorageAdapter` interface** (`put/get/getSignedUrl/delete/copy`) with drivers: `S3` (AWS S3 / Cloudflare R2 / MinIO), `Supabase`, `GoogleDrive`. Config-driven per brand.
- **Canonical store = S3-compatible.** Fast, effectively unlimited throughput, cheap egress on R2, native to Kubernetes. All workers write here first; `assets.storage_key` is the source of truth.
- **Drive mirror** runs as a **low-priority, rate-limited BullMQ queue** (global token-bucket at ≤3 writes/sec/account, exponential backoff on 403/429). This preserves the client-facing Drive deliverable per the prompt's storage tree without letting Drive throttle the pipeline. Populates `assets.drive_file_id`.
- **Per-account sharding** for Drive: if a single brand's volume approaches the cap, distribute across multiple service accounts (each with its own 3/sec budget) via a Shared Drive.

### 5.3 Drive folder structure (per the prompt)

```
/<Brand>/
  /<Year>/
    /<Month>/
      /<Campaign>/
        /Research/    /Scripts/     /Captions/
        /Images/      /Videos/      /GIFs/
        /Audio/       /Subtitles/   /Metadata/
        /Analytics/   /Logs/        /Version History/
```
Folder ids are cached in `brands.drive_folder_id` and a `drive_folders` lookup so the mirror worker never re-resolves paths (each resolution is a metered list call).

---

## 6. Queues (BullMQ topology)

Verified against **BullMQ 5.71 (Mar 2026)**: flow producers (DAGs), OpenTelemetry, priorities, rate limiting, DLQ patterns.

### 6.1 One queue per job type (no shared "work" queue)

| Queue | Concurrency profile | Priority | Rate limit | Retries / backoff | DLQ |
|---|---|---|---|---|---|
| `research` | I/O-bound (n8n, scraping) | normal | per external-source limits | 3, exp | `research.dlq` |
| `generate-text` | LLM I/O-bound, high conc. | high | per-provider token/RPM bucket | 4, exp + jitter | `text.dlq` |
| `generate-image` | GPU/API, medium conc. | normal | per-model concurrency cap | 3, exp | `image.dlq` |
| `generate-video` | very slow, low conc. | low | strict (1–2 in flight/model) | 2, exp | `video.dlq` |
| `review` | LLM, fast, high conc. | high | provider bucket | 3, exp | `review.dlq` |
| `publish` | time-critical | **highest** | per-platform + per-account | 5, exp | `publish.dlq` |
| `analytics` | scheduled polling | low | per-platform | 3, exp | `analytics.dlq` |
| `drive-mirror` | rate-limited copy | lowest | ≤3/sec/account | 5, exp | `drive.dlq` |
| `notify` | fast | high | channel limits | 3, exp | `notify.dlq` |

**Why per-type:** a 4-minute video job must never sit ahead of a 200ms grammar check. Separate queues + separate worker deployments let each scale independently (HPA on queue depth).

### 6.2 Topology details

- **FlowProducer for the content DAG:** research → strategy → plan → copy → image-prompt → video-prompt → review → (approval gate) → publish → analytics is modeled as a BullMQ **flow** so child completion drives the parent; a failed child fails the branch cleanly.
- **Rate limiting is global per queue** (token bucket): with 10 workers on `generate-text`, the queue-level limiter still caps combined throughput to the provider's RPM/TPM. Per-provider limiters live in the adapter layer keyed by `provider:model`.
- **Priorities:** `publish` > `generate-text`/`review` > `research`/`image` > `video`/`analytics`/`drive-mirror`.
- **Retries:** exponential backoff **with jitter**; idempotency keys on publish (so a retried publish doesn't double-post — check `external_post_id` first).
- **Dead-letter:** on final failure, the job is moved to `<queue>.dlq` with full context; a DLQ dashboard + `Error Recovery Agent` can inspect/replay. Alerts fire to `notify` on DLQ arrival.
- **Redis isolation at scale:** separate the BullMQ Redis from the cache Redis; partition hot queues across Redis Cluster hash slots to avoid head-of-line blocking.
- **Repeatable jobs** (analytics polling, scheduled campaigns) via BullMQ's repeat/cron; the flexible scheduler reads `campaigns.schedule` (rrule/cron) — **no hardcoded schedules**.

---

## 7. Observability

- **Structured logging:** JSON logs (pino) with `org_id`, `brand_id`, `campaign_id`, `job_id`, `trace_id` on every line → shipped to **Loki** (or hosted: Datadog/Better Stack). No PII/secrets in logs.
- **Metrics:** **Prometheus + Grafana**. Golden signals per service + queue depth, job latency by queue, retry/DLQ counts, worker saturation, provider error rates. HPA scales workers on queue depth.
- **Tracing:** **OpenTelemetry** end-to-end — web → API → queue → worker → adapter/n8n. BullMQ 5.71 emits OTel spans natively; the enqueue→process hop is stitched via propagated trace context. Backend: Tempo/Jaeger.
- **Per-agent cost & token tracking:** every AI call writes to `execution_logs` (provider, model, input/output tokens, `cost_usd`, `exec_ms`). Aggregated into `usage_records` for billing + a **Cost Optimizer** dashboard (cost per brand/campaign/agent, budget caps that pause `auto_mode` when exceeded).
- **Error tracking:** **Sentry** in web, API, and workers with release + `org_id` tags; DLQ arrivals and review-score failures raise structured events.
- **Uptime/health:** `/healthz` (liveness) + `/readyz` (DB/Redis/n8n checks) on every service; synthetic checks on publish path.

---

## 8. Deployment

### 8.1 Dev — Docker Compose

One `docker-compose.yml`: `web`, `api`, `workers`, `n8n`, `postgres`, `redis`, `minio` (S3-compatible), `mailhog`, plus Grafana/Prometheus optional. Single `.env` with `APP_ENV=DEV`, prefix-based config per the global env standard. `pnpm dev` runs the Turborepo graph with hot reload.

### 8.2 Prod — Kubernetes-ready

- **Stateless services** (`web`, `api`, `workers`, `n8n` in queue mode) → Deployments with `HPA` (web/API on CPU+RPS; workers on **queue depth** via KEDA/custom metrics).
- **Config via env + Secrets** (K8s Secrets sourced from KMS/Vault; no secrets in images).
- **Stateful** (Postgres primary+replica, Redis) → **managed services** (RDS/Cloud SQL + ElastiCache/Upstash) rather than in-cluster, for backups/HA. **pgBouncer** for pooling.
- **Ingress** (Nginx/Traefik) + TLS (cert-manager) + WAF + rate limiting at the edge.
- **Object storage:** S3/R2 (managed), Drive via API.

### 8.3 CI/CD — GitHub Actions

`lint → typecheck → unit test → integration test (ephemeral Postgres+Redis) → build (Turborepo cache, changed packages only) → build/push Docker images → deploy`. Preview envs per PR; prod deploy gated on green + manual approval; DB migrations run as a pre-deploy job (expand/contract, reversible). Pre-deploy gate agents (migration-safety, isolation-auditor, cross-platform-linter) run in parallel.

### 8.4 Infra honesty (shared Hostinger VPS)

The shared Hostinger VPS (187.124.74.175) already runs n8n on 5678 and multiple apps. It is **fine for dev, demos, and a single-brand pilot**, but **not sufficient at target scale** (500 brands / 10k assets / 1k posts a day):

- Video/image generation, 9-stage review, and concurrent worker fan-out are CPU/RAM/GPU heavy — one VPS will saturate.
- Postgres + Redis + n8n + workers co-located on one box = shared-fate blast radius; a runaway generation job takes down publishing.
- **Recommendation:** pilot on the VPS; for production move to a **managed Kubernetes cluster** (GKE/EKS/DigitalOcean/Hetzner) with **managed Postgres + Redis** and **autoscaling worker pools**, GPU nodes (or external GPU APIs) for image/video. Keep n8n on its own node/queue mode. Budget for object-storage egress and per-MAU auth cost.

---

## 9. Recommended Monorepo Folder Structure

```
ai-marketing-platform/
├─ apps/
│  ├─ web/                        # Next.js 16 (App Router, RSC, ShadCN, RQuery, Zustand, Framer)
│  │  ├─ app/                     # routes: dashboard, campaigns, brands, agents, media...
│  │  ├─ components/              # ui/ (ShadCN), features/
│  │  ├─ lib/                     # api client, query hooks, stores
│  │  └─ middleware.ts            # Clerk + tenant guard (proxy.ts in Next 16)
│  ├─ api/                        # Express + TS (DDD)
│  │  ├─ src/
│  │  │  ├─ domain/               # brand, campaign, content, publishing, analytics
│  │  │  ├─ http/                 # routes, controllers, dto
│  │  │  ├─ middleware/           # auth, tenant-context(RLS), rbac, ratelimit, error
│  │  │  ├─ services/             # orchestration; enqueue jobs, call n8n
│  │  │  └─ repositories/         # TenantDb-scoped data access
│  │  └─ index.ts
│  ├─ workers/                    # BullMQ consumers (one process per queue group)
│  │  └─ src/processors/          # research, text, image, video, review, publish, analytics, drive-mirror, notify
│  └─ n8n/                        # self-hosted config + exported modular workflows
│     └─ workflows/               # research/, publish/<platform>/, analytics/
├─ packages/
│  ├─ db/                         # schema, migrations, RLS policies, seed, TenantDb
│  ├─ contracts/                  # zod schemas + shared TS types (web↔api↔workers)
│  ├─ adapters/
│  │  ├─ ai/                      # openai, anthropic, gemini, groq, openrouter, ollama
│  │  ├─ image/                   # flux, sdxl, ideogram, gpt-image, comfyui
│  │  ├─ video/                   # higgsfield, veo, kling, runway, seedance, hailuo, pika
│  │  ├─ storage/                 # s3, supabase, googleDrive (StorageAdapter)
│  │  └─ social/                  # youtube, instagram, facebook, linkedin, x
│  ├─ queue/                      # BullMQ queue defs, FlowProducer, rate limiters, DLQ
│  ├─ auth/                       # Clerk wrapper (Better Auth swap point) + RBAC
│  ├─ secrets/                    # envelope encryption (KMS/Vault) helpers
│  ├─ config/                     # env loader (APP_ENV TEST|DEV|PROD)
│  ├─ logger/                     # pino + OTel + trace context
│  └─ ui/                         # shared ShadCN component library + tokens
├─ infra/
│  ├─ docker/                     # Dockerfiles, docker-compose.yml (dev)
│  ├─ k8s/                        # deployments, HPA/KEDA, ingress, secrets, hpa
│  └─ ci/                         # GitHub Actions workflows
├─ docs/                          # architecture, api, runbooks, COORDINATION.md
├─ turbo.json  ·  pnpm-workspace.yaml  ·  package.json  ·  .env.example
```

---

## 10. Security

- **RBAC** enforced in two layers: API `authorize(permission)` guard + RLS `WITH CHECK` on writes. Four roles (Admin/Manager/Editor/Viewer); custom per-org roles supported via `roles`.
- **Tenant isolation:** shared-schema + `org_id` + **forced RLS**; non-superuser, non-BYPASSRLS app DB role; request/worker tenant context set per transaction; isolation-auditor agent gates PRs.
- **Secrets:** envelope encryption (AES-256-GCM DEK wrapped by KMS KEK) for per-brand provider/social keys; inbound API keys hashed; secrets never logged or sent to the browser; KEK rotation via rewrap.
- **Audit logs:** `audit_logs` (who/what/before/after/ip) for every state change; `execution_logs` for every AI run (prompt/model/tokens/cost). Immutable, org-scoped, retained.
- **Rate limiting:** edge (Nginx) + per-route (API, per-org token bucket in Redis) + per-provider (adapter) + per-platform (publish). Protects against abuse and runaway `auto_mode` cost.
- **Transport & headers:** TLS 1.3 everywhere, HSTS, CSP, secure cookies, CSRF protection on state-changing routes; signed webhooks between n8n↔API.
- **Input validation:** zod at every boundary (HTTP dto, job payloads, webhook bodies); parameterized queries only.
- **Backup / DR:** managed Postgres PITR + daily snapshots (cross-region copy); object storage versioning + lifecycle; Redis is treated as **replaceable** (jobs re-derivable from Postgres state, not the source of truth); documented **RTO/RPO** and a restore-tested runbook; n8n workflows and secrets (wrapped) exported to the backup set. Regular restore drills.

---

## Sources (verified 2026)

- Next.js 16: <https://nextjs.org/blog/next-16> · stable version tracking: <https://abhs.in/blog/nextjs-current-version-march-2026-stable-release-whats-new>
- Multi-tenancy (shared schema + RLS default): <https://gsoftconsulting.com/en/blog/building-multi-tenant-saas-2026> · <https://medium.com/@moyo.sore.oluwa/strict-data-isolation-in-multitenant-systems-with-postgresql-aa615052fe80> · <https://dasroot.net/posts/2026/01/multi-tenancy-database-patterns-schema-database-row-level/>
- Auth (Clerk orgs / Better Auth / NextAuth): <https://makerkit.dev/blog/tutorials/better-auth-vs-clerk> · <https://gautamkhorana.com/authentication/compare/authjs-vs-clerk/>
- BullMQ topology / rate limiting / DLQ (v5.71): <https://markaicode.com/architecture/bullmq-production-system-design-architecture/> · <https://docs.bullmq.io/guide/rate-limiting> · <https://dev.to/young_gao/bullmq-job-queues-background-processing-in-nodejs-done-right-5306>
- Google Drive quotas (May 2026 model + ~3 writes/sec cap): <https://developers.google.com/workspace/drive/api/guides/limits> · <https://folderpal.io/articles/how-to-handle-google-drive-api-rate-limits-for-bulk-folder-copying-and-automation>
- Secrets / envelope encryption: <https://earezki.com/ai-news/2026-04-26-persistent-jwt-signing-keys-with-postgresql/> · <https://www.decryptiondigest.com/blog/data-encryption-at-rest-in-transit-guide>
- Monorepo (pnpm + Turborepo, Next.js + Express): <https://ecosire.com/blog/nextjs-16-app-router-production>
```
