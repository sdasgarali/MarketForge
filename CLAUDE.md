# CLAUDE.md — AI Marketing Automation Platform (codename: MarketForge)

> Project rules — auto-loaded every turn. Keep under 200 lines. Deep detail lives in
> `CLAUDE_REFERENCE/` and `research/` (read on demand). Global rules: `~/.claude/CLAUDE.md`.

## What this is
Enterprise, multi-brand, AI-powered marketing-automation SaaS (HubSpot/Buffer/Jasper-class).
Core loop: **Research → Generate (copy/image/video/voice) → AI Review/Score → Approve → Schedule → Publish → Analytics → Optimize**, for many brands, minimal human touch. Source spec: `prompt.txt`.

**Status:** MVP SCAFFOLD BUILT (Phase 1 in progress). Monorepo compiles/typechecks/tests green
(19/19 typecheck, 11/11 build, 60 tests). Adapters call real SDKs but are inert without API keys.
Next: provision infra (`docker compose up`), migrate+seed, wire real keys, end-to-end smoke test.
See `README.md` to run. Remaining product questions (scale/quality-rubric/hosting/legal) in `Master_Plan.md §2`.

## MVP scope — LOCKED 2026-07-31
- **Platforms:** **X + Instagram** only (least-gated; via aggregator).
- **Budget:** **Lean, < $500/mo** total (AI + publishing). Forces: cheap-tier model routing, aggressive
  prompt-caching + batching, **image-only (no video in MVP)**, small pilot brand count. NOTE: Ayrshare
  Business is ~$599/mo (over budget) → MVP uses **Ayrshare Premium (~$149, single-brand)** OR self-hosted
  **Postiz** (free) — decision pending (see Master_Plan §2a).
- **Publish policy:** **per-brand trust tiers** — new brands require human approval; trusted brands may
  graduate to auto-publish after AI score passes threshold.
- **Video:** deferred to **Phase 3**, metered. Roster includes **Kling** (via fal.ai, NOT native API — see ADR-007).

## Golden decisions (locked from research — see CLAUDE_REFERENCE/architecture-decisions.md)
- **Multi-tenancy:** shared Postgres schema + `org_id` on every table + **Row-Level Security (FORCE)**. Guard middleware sets `app.current_org` per transaction; all queries via a `TenantDb` wrapper.
- **Auth:** **Clerk** (Organizations + roles: Admin/Manager/Editor/Viewer), mirrored into Postgres so RBAC+RLS run off our tables. Exit hatch: Better Auth behind `packages/auth`.
- **Publishing (MVP):** **Ayrshare** aggregator — one API, all 5 platforms, per-brand "profiles", and it **absorbs LinkedIn/Meta app-review**. Behind a `PublisherAdapter`. Scale path: self-host Postiz + direct YouTube Data API.
- **Scheduler:** **backend-owned** (BullMQ delayed jobs on Redis). n8n does NOT own the clock.
- **n8n role:** integration engine only — runs in **queue mode**, invoked per-job via webhook, built as **modular sub-workflows** (never one monolith). Backend decides *what/when*; n8n does the external-API *doing* and reports back. Per-brand identity passed as payload, not as thousands of n8n credentials.
- **Storage:** **S3-compatible object store = system of record.** Google Drive is a rate-limited per-brand **mirror only** (Drive caps ~3 writes/s/account — cannot be primary).
- **AI providers:** adapter layer with **task/cost routing** — copywriting=Claude Sonnet 4.6, QA/review=Claude Opus 4.8, bulk tags=Gemini Flash-Lite/Groq. Images=`nano-banana-2` MCP + fal (Ideogram/Seedream/Flux). Video (Phase 3)=Veo 3.1 MCP + Runway + **Kling (via fal)** + fal others. Voice/subtitles=ElevenLabs. **Connected MCP servers are the ready adapter backends** (fal, nano-banana-2, google-veo-3-1, higgsfield, suno, elevenlabs).
- **Monorepo:** pnpm workspaces + Turborepo — `apps/{web,api,worker,n8n}` + `packages/{adapters,db,contracts,queue,auth,secrets}`.
- **Queues:** BullMQ, one queue per job type (research, generate-*, review, publish, analytics, drive-mirror, notify); priorities (publish highest, video lowest), retries+jitter, DLQs, FlowProducer for the content DAG.

## Hard constraints (do not violate)
- **Never publish immediately** — every content item passes AI review + composite score; auto-regen if < threshold; human approval gate per brand trust-tier.
- **Video is Phase 3, opt-in, metered** — 2026 video APIs run $0.05–$0.75/sec; uncontrolled = thousands $/day. Not in MVP.
- **Content moderation gate is mandatory** before any AI-generated "character"/image reaches a real brand account (brand-safety + legal/likeness).
- **Every AI call is logged** with model, tokens, cost, latency, retries, output version.
- **Tenant isolation is sacred** — no query without `org_id` scope. Use `multi-tenant-isolation-auditor` after touching queries/endpoints.
- **Config in DB, secrets encrypted** (envelope AES-256-GCM DEK wrapped by KMS/Vault KEK). No hardcoded models/keys/schedules.

## Tech stack
Frontend: Next.js (latest) + TS + Tailwind + ShadCN + React Query + Zustand + Framer Motion.
Backend: Node + Express + TS (DDD/clean architecture). DB: PostgreSQL (RLS) + Redis (BullMQ/cache).
Storage: S3-compatible primary, Google Drive mirror. Automation: self-hosted n8n (queue mode).
Auth: Clerk. Deploy: Docker Compose (dev) → Kubernetes + managed PG/Redis + KEDA autoscaling (scale).

## Repository / doc map
| Topic | Read |
|---|---|
| Full spec (source of truth) | `prompt.txt` |
| Phased roadmap + open questions + MVP scope | `Master_Plan.md` |
| Session resume point / current TODO | `Plan_WIP.md` |
| Architecture Decision Records (distilled) | `CLAUDE_REFERENCE/architecture-decisions.md` |
| Requirements catalog + MoSCoW + risks + competitor benchmark | `research/03-requirements-analysis.md` |
| AI generation stack (LLM/image/video/voice, cost matrix) | `research/01-ai-generation-stack.md` |
| Publishing + n8n scaling + platform API constraints | `research/02-publishing-n8n-architecture.md` |
| Platform architecture, data model, multi-tenancy, DevOps | `research/04-platform-architecture-devops.md` |
| n8n global standard (CLI, API pattern) | `~/.claude/CLAUDE_REFERENCE/n8n-integration.md` |
| Shared VPS deploy (dev/pilot only) | `~/.claude/CLAUDE_REFERENCE/vps-deployment.md` |

> Full Postgres schema lives in `research/04-...md` (do not duplicate it here — point to it).

## Parked side-task
`social-post-scheduler.workflow.json` — a standalone n8n workflow that auto-publishes the Exzelon
tracker's Social Media Calendar via Ayrshare. Independent of the platform build; can seed the
publishing sub-workflow. See its own notes in git history / that file.

## Working agreements
- Follow global `~/.claude/CLAUDE.md` (planning-to-files, small slices, tests, cross-platform, sub-agent fan-out).
- **Plan before code**: write plan to file, get approval, then execute in small verifiable slices.
- Update this file + `CLAUDE_REFERENCE/` after every architecture decision, new service, model, or endpoint.
- Env: single `.env`, `APP_ENV=TEST|DEV|PROD` prefixing. Windows + Linux both must work.
- Enterprise quality only — error handling, logging, validation, retries, observability. No prototypes.
