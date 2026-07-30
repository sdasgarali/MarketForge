# Architecture Decision Records — MarketForge

> Referenced from: `E:\chapter 2\N8N\CLAUDE.md`. Distilled, decided architecture. Deep rationale
> and alternatives live in `research/*.md`. Read this before touching architecture.

Each ADR: Decision · Why · Alternatives rejected · Source.

---

## ADR-001 — Multi-tenancy: shared schema + Postgres RLS
**Decision:** Single Postgres schema, `org_id` on every tenant table, Row-Level Security enabled
AND `FORCE`d, app connects as a non-`BYPASSRLS` role. Guard middleware runs `SET LOCAL
app.current_org = <id>` per transaction (HTTP requests and BullMQ workers alike); all DB access
goes through a `TenantDb` wrapper.
**Why:** Verified 2026 default for the 100–10k-tenant band; 500 brands is small. RLS is a DB-enforced
safety net behind app-level scoping — closes the "forgotten WHERE clause" leak.
**Rejected:** schema-per-tenant / db-per-tenant (operational overhead at 500 tenants). Escape hatch:
promote a marquee client to a dedicated DB later without a rewrite.
**Source:** research/04.

## ADR-002 — Auth: Clerk (Organizations), mirrored to Postgres
**Decision:** Clerk as IdP using its Organizations + roles primitive (Admin/Manager/Editor/Viewer).
Mirror orgs/users/memberships into Postgres so all RBAC + RLS run off our own tables.
**Why:** First-class B2B orgs save 2–4 weeks of glue; mirroring keeps us portable.
**Rejected (as default):** Auth.js/Better Auth now — kept as a pre-planned self-host exit behind a
thin `packages/auth` adapter if per-MAU cost/lock-in bites.
**Source:** research/04.

## ADR-003 — Publishing: Ayrshare aggregator for MVP
**Decision:** Publish via Ayrshare behind a `PublisherAdapter` interface. Each brand = an Ayrshare
"profile". It reaches YouTube/IG/FB/LinkedIn/X and returns analytics.
**Why:** It **inherits the platforms' app-review approvals**, skipping 2–4 months of per-platform
OAuth/review onboarding (LinkedIn Partner review, Meta business verification). Fastest correct path.
**Scale path:** self-host Postiz (OSS, REST+MCP) to drop per-profile fees once brand count dominates
the bill; move YouTube to direct Data API v3 (upload cost dropped ~1600→~100 units, Dec 2025).
**Rejected for MVP:** direct platform APIs (months of review friction).
**Source:** research/02.

## ADR-004 — Scheduler owned by backend, not n8n
**Decision:** The scheduling clock is **BullMQ delayed jobs on Redis**, owned by the Node/Express
backend. n8n never owns timing.
**Why:** Timezone handling, retry counts, idempotency, and per-brand state belong with business
logic + DB. n8n schedule triggers don't scale to 1k+ tenant-scoped jobs/day cleanly.
**Source:** research/02.

## ADR-005 — n8n = integration engine only (queue mode, modular)
**Decision:** n8n runs in **queue mode** (main + N workers + Redis + Postgres), invoked per-job via
webhook from the backend, built as **modular sub-workflows** (orchestrator → `wf-publish-*`,
`wf-generate-*`, `wf-collect-analytics`, `wf-error-handler`) — never one monolith. Per-brand
identity is passed in the payload (aggregator profileKey / injected token), NOT stored as thousands
of n8n credentials.
**Boundary:** Backend decides *what* and *when* (logic, RBAC, DB, schedule, secrets, retry/idempotency
decisions); n8n does the external-API *doing* and reports back.
**Source:** research/02.

## ADR-006 — Storage: S3 primary, Google Drive mirror only
**Decision:** S3-compatible object store is the system of record. Google Drive is a low-priority,
rate-limited, per-brand **mirror**, behind a `StorageAdapter`. Heavy brands shard across multiple
Drive service accounts.
**Why:** Google Drive caps sustained writes at ~3 req/s/account (non-increasable) and since May 2026
meters a shared quota-unit pool — bursty 10k-assets/day fan-outs would stall on it. The prompt's
"Drive as primary" is not viable at scale.
**Source:** research/04.

## ADR-007 — AI providers: adapter layer with task/cost routing
**Decision:** All LLM/image/video/voice access behind replaceable adapters with a router that picks
model by task + cost + fallback chain.
- Copywriting → **Claude Sonnet 4.6**; QA/review/reasoning → **Claude Opus 4.8**; bulk tags/hashtags → **Gemini Flash-Lite / Groq** (batched).
- Images → **`nano-banana-2` MCP** workhorse + **fal** (Ideogram v3 / Seedream 4.0 for text-heavy, FLUX Kontext for edits). Self-host Flux/SDXL on ComfyUI for bulk at scale (break-even ~1k+ imgs/day).
- Video (Phase 3) → **Veo 3.1 (`google-veo-3-1` MCP)** + Runway Gen-4 + **Kling** + fal (Hailuo/Pika). All cap 5–10s/gen → design for stitched segments; only Veo/Runway/Kling carry native audio.
  - **Kling (user-requested):** integrate **via fal.ai's queue API**, NOT Kling's native API (native requires ~$4.2k prepaid + lacks clean webhooks/batch). fal Kling pricing ~$0.28/s. Keep behind the same `VideoAdapter`.
- Voice + subtitles → **ElevenLabs** (subtitles via `with-timestamps`, no separate STT).
**Ready backends:** connected MCP servers `fal`, `nano-banana-2`, `google-veo-3-1`, `higgsfield`,
`suno`, `elevenlabs` map 1:1 onto generation adapters.
**Cost levers:** task-tier routing + brand-prefix prompt caching + Batch APIs (−50%) + self-host bulk images/STT.
**Cautions:** Suno has no production public API (use ElevenLabs Music for scaled licensed music);
GPT Image API removal announced Dec 1 2026 (don't make it core).
**Source:** research/01.

## ADR-008 — Monorepo + queue topology
**Decision:** pnpm workspaces + Turborepo. `apps/{web (Next.js), api (Express), worker, n8n}` +
`packages/{adapters, db, contracts, queue, auth, secrets}`. API never blocks on long work — it
enqueues (job carries `org_id`/`brand_id`) and returns 202; workers stream progress via SSE.
**Queues (BullMQ, one per job type):** research, generate-text, generate-image, generate-video,
review, publish, analytics, drive-mirror, notify. Per-queue rate limits; priorities (publish highest,
video lowest); retries + jitter; DLQs; FlowProducer for the content DAG.
**Source:** research/04.

## ADR-009 — Security & observability baseline
**Decision:** Per-brand secrets via envelope encryption (AES-256-GCM DEK wrapped by KMS/Vault KEK);
inbound API keys hashed. Structured logging; per-agent/per-run cost + token tracking; Sentry error
tracking; Prometheus/Grafana metrics; full audit_logs; rate limiting; scheduled backups + DR drills.
**Source:** research/04, prompt.txt (Security/Logging).

## ADR-010 — Deployment path
**Decision:** Docker Compose for dev/pilot (Postgres, Redis, n8n queue mode, api, worker, web).
Kubernetes-ready (stateless services, config via env/secrets) for scale: managed Postgres (replicas +
pgBouncer) + managed Redis + KEDA autoscaling worker pools on queue depth. The shared Hostinger VPS
is **dev/pilot only** — target scale needs managed cloud/K8s.
**Source:** research/04.
