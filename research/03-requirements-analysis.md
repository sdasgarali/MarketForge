# Requirements Analysis — Enterprise AI Marketing Automation Platform

> **Role:** Senior Business Systems Analyst
> **Source:** `E:\chapter 2\N8N\prompt.txt` (1005 lines) — master prompt for a HubSpot/Buffer/Hootsuite/Sprout/Jasper-like AI-powered, multi-brand, n8n-driven social content platform.
> **Date:** 2026-07-30
> **Purpose:** Convert the master prompt into a rigorous, prioritized requirements catalog, a realistic MVP definition, a competitor benchmark, a risk/gap register, and phased effort sizing.

---

## 0. Executive Summary

The prompt describes an ambitious, end-to-end SaaS: **research → generate (text/image/video/voice/subtitles) → multi-stage AI review → schedule → publish → analytics → optimize**, across 5+ social platforms, 24+ AI agents, a 20+-item dashboard, multi-brand profiles, RBAC, and billing — targeting **500+ companies, 10k assets/day, 1k posts/day**.

**Verdict:** This is a **12–18 month, multi-team program**, not an MVP. The single most valuable thing to prove first is the **core content loop for ONE brand across 2 platforms with human approval**. Everything else (video generation, 500-tenant scale, 24 agents, billing, K8s) is Phase 2+. The biggest existential risks are **not technical build effort** but **external platform API access (LinkedIn Partner Program, X/TikTok quotas), AI video cost blowup, content moderation liability, and the automation-vs-approval tension**. These must be de-risked before committing to the full architecture.

---

## 1. Functional Requirements Catalog

Each requirement has a stable ID, a MoSCoW priority **for the MVP**, and a target phase. Legend: **M**=Must, **S**=Should, **C**=Could, **W**=Won't (for MVP). Phase: **P1** (MVP) / **P2** / **P3**.

### 1.1 Brand Management (`FR-BRAND-*`)

| ID | Requirement | MoSCoW | Phase |
|---|---|---|---|
| FR-BRAND-01 | Create/edit/delete a brand profile (company name, website, industry, products, services). | M | P1 |
| FR-BRAND-02 | Store brand identity: logo, colors, fonts, icons. | M | P1 |
| FR-BRAND-03 | Store brand voice, writing style, preferred CTA, negative prompt. | M | P1 |
| FR-BRAND-04 | Store mission, vision, target audience, competitors. | S | P1 |
| FR-BRAND-05 | Store image style, video style, aspect-ratio defaults per platform. | S | P1 (image), P2 (video) |
| FR-BRAND-06 | Approved AI character library per brand (reusable persona seeds). | C | P2 |
| FR-BRAND-07 | Connect/store social account credentials (OAuth tokens) per brand. | M | P1 |
| FR-BRAND-08 | Publishing schedule defaults + timezone per brand. | M | P1 |
| FR-BRAND-09 | Google Drive folder mapping per brand. | S | P2 |
| FR-BRAND-10 | Multi-language config per brand. | C | P2 |
| FR-BRAND-11 | Per-brand prompt templates. | S | P2 |
| FR-BRAND-12 | Per-brand approval settings (auto vs manual, threshold). | M | P1 |
| FR-BRAND-13 | Per-brand knowledge base (RAG: website crawl, docs, FAQs). | S | P2 |
| FR-BRAND-14 | Brand analytics history retention. | S | P2 |
| FR-BRAND-15 | Website ingestion — crawl the brand site to auto-populate context. | S | P2 |

### 1.2 Scheduling (`FR-SCHED-*`)

| ID | Requirement | MoSCoW | Phase |
|---|---|---|---|
| FR-SCHED-01 | DB-driven (non-hardcoded) scheduling engine with the prescribed schema (campaign, brand, platform, topic, priority, date, time, tz, language, status, retry count, type, flags). | M | P1 |
| FR-SCHED-02 | One-time scheduled posts. | M | P1 |
| FR-SCHED-03 | Recurring campaigns (daily/weekly/monthly). | S | P2 |
| FR-SCHED-04 | Timezone-correct execution (per brand/audience). | M | P1 |
| FR-SCHED-05 | Holiday / seasonal / product-launch campaign types. | C | P3 |
| FR-SCHED-06 | Emergency announcement (high-priority, jump queue). | C | P2 |
| FR-SCHED-07 | Manual vs automatic publishing toggle. | M | P1 |
| FR-SCHED-08 | Optimal send-time suggestion from analytics. | C | P3 |
| FR-SCHED-09 | Content calendar (visual). | S | P2 |
| FR-SCHED-10 | Collision detection (two editors on same slot). | C | P3 |

### 1.3 Research (`FR-RSCH-*`)

| ID | Requirement | MoSCoW | Phase |
|---|---|---|---|
| FR-RSCH-01 | Trigger a research pass before generation; produce a structured research report artifact. | M | P1 |
| FR-RSCH-02 | Google Trends ingestion. | S | P2 |
| FR-RSCH-03 | Industry news / RSS / blog ingestion. | S | P2 |
| FR-RSCH-04 | Reddit / community discussion mining. | C | P3 |
| FR-RSCH-05 | LinkedIn / X trend mining. | C | P3 (API-gated) |
| FR-RSCH-06 | Competitor post scraping. | C | P3 (ToS-risky) |
| FR-RSCH-07 | SEO keyword + search-intent research. | S | P2 |
| FR-RSCH-08 | FAQ / customer-review / pain-point extraction. | C | P2 |
| FR-RSCH-09 | Hashtag + hook + seasonal-event suggestions. | S | P2 |
| FR-RSCH-10 | Research report stored, versioned, reusable across a campaign. | S | P1 |

**MVP note:** For P1, "research" = **one LLM-with-web-search agent** producing a topic brief. The 18-source firehose (FR-RSCH-02..09) is Phase 2/3 and mostly gated by third-party API access and ToS.

### 1.4 AI Content Generation (`FR-GEN-*`)

| ID | Requirement | MoSCoW | Phase |
|---|---|---|---|
| FR-GEN-01 | Text/copy generation per platform (never identical across platforms). | M | P1 |
| FR-GEN-02 | Platform-specific content shaping (YouTube/IG/FB/LinkedIn/X variants). | M (2 platforms), S (all) | P1 / P2 |
| FR-GEN-03 | Caption + hashtag generation. | M | P1 |
| FR-GEN-04 | Image generation (posters, carousels, banners, thumbnails, infographics). | M (basic image), S (all types) | P1 / P2 |
| FR-GEN-05 | Multi-provider LLM abstraction (OpenAI, Claude, Gemini, Groq, OpenRouter, Ollama). | S (design for it; ship 1–2) | P1 |
| FR-GEN-06 | Multi-provider image-model abstraction (Flux, SDXL, Ideogram, GPT Image, ComfyUI). | S (ship 1) | P1 |
| FR-GEN-07 | Video generation (YouTube, Shorts, Reels) via multi-provider abstraction. | W | P3 |
| FR-GEN-08 | Voiceover generation (TTS). | W | P3 |
| FR-GEN-09 | Subtitle generation. | W | P3 |
| FR-GEN-10 | GIF generation. | W | P3 |
| FR-GEN-11 | Background music / transitions / brand intro-outro. | W | P3 |
| FR-GEN-12 | AI character generation with brand-specific styling + safety negative prompts. | C | P2 |
| FR-GEN-13 | Prompt Library (reusable, versioned prompts). | S | P2 |
| FR-GEN-14 | Auto-regenerate content that fails review threshold. | S | P1 |

### 1.5 Review / QA (`FR-REV-*`)

| ID | Requirement | MoSCoW | Phase |
|---|---|---|---|
| FR-REV-01 | Never auto-publish without passing review gate. | M | P1 |
| FR-REV-02 | Grammar + spelling check. | M | P1 |
| FR-REV-03 | Brand-compliance check (voice, banned terms, CTA). | M | P1 |
| FR-REV-04 | Fact-check pass. | S | P2 |
| FR-REV-05 | Copyright / plagiarism / duplicate detection. | S | P2 |
| FR-REV-06 | Platform-policy check (per-platform content rules). | S | P2 |
| FR-REV-07 | SEO quality check. | C | P2 |
| FR-REV-08 | Visual quality check (image). | C | P2 |
| FR-REV-09 | Accessibility check (alt text, contrast). | C | P3 |
| FR-REV-10 | Composite score; if <90 → auto-regenerate (bounded retries). | S | P1 |
| FR-REV-11 | Human approval queue (approve/reject/edit per item). | M | P1 |
| FR-REV-12 | Bulk Approve-All / Reject-All. | S | P1 |

### 1.6 Publishing (`FR-PUB-*`)

| ID | Requirement | MoSCoW | Phase |
|---|---|---|---|
| FR-PUB-01 | Publish approved assets at scheduled time via platform APIs. | M | P1 |
| FR-PUB-02 | Pre-publish media validation (dimensions, size, duration, format). | M | P1 |
| FR-PUB-03 | Verify successful upload; store post URL, timestamp, platform ID. | M | P1 |
| FR-PUB-04 | Retry-with-backoff on failure; dead-letter after N retries. | M | P1 |
| FR-PUB-05 | Publishing queue with pause/resume/cancel/restart. | S | P1 |
| FR-PUB-06 | Platform adapter abstraction (replaceable per platform). | M | P1 |
| FR-PUB-07 | Rate-limit / quota-aware throttling per platform + per account. | M | P1 |
| FR-PUB-08 | Emergency-Stop (halt all publishing immediately). | S | P1 |
| FR-PUB-09 | Notify dashboard on publish result. | M | P1 |

### 1.7 Analytics (`FR-ANL-*`)

| ID | Requirement | MoSCoW | Phase |
|---|---|---|---|
| FR-ANL-01 | Pull per-post metrics (views, reach, impressions, likes, comments, shares, CTR). | S | P1 (partial) |
| FR-ANL-02 | Watch time, followers, engagement rate, conversions. | C | P2 |
| FR-ANL-03 | Store historical metrics time-series. | S | P1 |
| FR-ANL-04 | Per-brand / per-campaign / per-platform dashboards. | S | P2 |
| FR-ANL-05 | Feed analytics back into generation strategy (optimization loop). | C | P3 |
| FR-ANL-06 | Exportable reports (PDF/CSV). | C | P2 |

### 1.8 Notifications (`FR-NOT-*`)

| ID | Requirement | MoSCoW | Phase |
|---|---|---|---|
| FR-NOT-01 | In-dashboard notifications (success/failure/warning/queue/approval). | M | P1 |
| FR-NOT-02 | Email notifications. | S | P1 |
| FR-NOT-03 | Slack / Discord / Telegram channels. | C | P2 |
| FR-NOT-04 | Approval-request notifications with deep link. | S | P1 |

### 1.9 Dashboard / UX (`FR-UX-*`)

| ID | Requirement | MoSCoW | Phase |
|---|---|---|---|
| FR-UX-01 | Core nav: Dashboard, Brands, Campaigns, Approval Queue, Publishing Queue, Media Library, Settings. | M | P1 |
| FR-UX-02 | Content Calendar view. | S | P2 |
| FR-UX-03 | Workflow Monitor (live run status). | S | P1 |
| FR-UX-04 | Analytics + Reports views. | S | P2 |
| FR-UX-05 | System Logs view. | S | P1 |
| FR-UX-06 | Research Center, Prompt Library, AI Agents, API Manager, Integrations, Asset Manager panels. | C | P2/P3 |
| FR-UX-07 | Action buttons: Run Now, Auto Mode, Pause, Resume, Emergency Stop, Retry Failed, Generate Only, Publish Only, Approve/Reject All, Cancel/Restart Queue, Refresh. | S (core subset M) | P1/P2 |
| FR-UX-08 | Dark mode + responsive design. | S | P1 |
| FR-UX-09 | Billing view. | W | P3 |

### 1.10 Users / RBAC (`FR-RBAC-*`)

| ID | Requirement | MoSCoW | Phase |
|---|---|---|---|
| FR-RBAC-01 | Authentication (Clerk or Auth.js). | M | P1 |
| FR-RBAC-02 | Roles: Admin, Manager, Editor, Viewer. | M | P1 |
| FR-RBAC-03 | Role-scoped access to brands/campaigns/actions. | M | P1 |
| FR-RBAC-04 | Multi-tenant isolation (org → brands → users). | M | P1 |
| FR-RBAC-05 | Audit log of user actions. | S | P1 |
| FR-RBAC-06 | User invitation / team management. | S | P2 |

### 1.11 Billing (`FR-BILL-*`)

| ID | Requirement | MoSCoW | Phase |
|---|---|---|---|
| FR-BILL-01 | Usage metering (tokens, images, videos, posts, API cost per tenant). | S (meter early) | P2 |
| FR-BILL-02 | Subscription plans + payment (Stripe). | W | P3 |
| FR-BILL-03 | Cost caps / budget alerts per brand. | S | P2 |
| FR-BILL-04 | Invoicing. | W | P3 |

### 1.12 Integrations (`FR-INT-*`)

| ID | Requirement | MoSCoW | Phase |
|---|---|---|---|
| FR-INT-01 | Social platform OAuth + publishing (start: 2 platforms). | M | P1 |
| FR-INT-02 | Google Drive storage integration. | S | P2 |
| FR-INT-03 | n8n orchestration engine (self-hosted). | M | P1 |
| FR-INT-04 | Object storage abstraction (S3/Supabase/local). | S | P1 |
| FR-INT-05 | AI provider integrations behind adapters. | M | P1 |
| FR-INT-06 | API Manager (manage third-party keys, per-tenant). | S | P2 |

### 1.13 Logging / Observability (`FR-LOG-*`)

| ID | Requirement | MoSCoW | Phase |
|---|---|---|---|
| FR-LOG-01 | Structured log per action (timestamp, workflow, agent, prompt, model, exec time, tokens, cost, errors, retries, output version). | M | P1 |
| FR-LOG-02 | Per-run trace across the multi-agent pipeline (correlation ID). | M | P1 |
| FR-LOG-03 | Cost/token dashboards. | S | P2 |
| FR-LOG-04 | Metrics + alerting (Prometheus/Grafana or hosted). | S | P2 |
| FR-LOG-05 | Error-recovery agent / auto-retry orchestration. | S | P2 |

### 1.14 AI Agent Architecture (`FR-AGENT-*`)

The prompt lists 24 agents. Treat each as a **role/prompt inside the pipeline**, not 24 microservices. Each must define input, output, responsibilities, fallback, retry, logging, metrics.

| ID | Requirement | MoSCoW | Phase |
|---|---|---|---|
| FR-AGENT-01 | Agent abstraction: standard I/O contract, retry, fallback model chain, logging, metrics. | M | P1 |
| FR-AGENT-02 | MVP agent set: Research, Copywriter, Brand-Compliance, Grammar, Image-Prompt, QA/Scorer. | M | P1 |
| FR-AGENT-03 | Extended agents: SEO, Strategist, Planner, Fact-Checker, Hashtag, Publishing, Analytics, Optimizer, etc. | S/C | P2/P3 |
| FR-AGENT-04 | Video/voice/subtitle/character agents. | W | P3 |
| FR-AGENT-05 | Cost-Optimizer + Prompt-Optimizer agents. | C | P3 |

---

## 2. Non-Functional Requirements (`NFR-*`)

| ID | Category | Requirement | MoSCoW (MVP) | Target |
|---|---|---|---|---|
| NFR-SCALE-01 | Scale | Support 500+ tenants. | W | Design-for, prove at 5–20 in P1 |
| NFR-SCALE-02 | Scale | 10,000+ generated assets/day. | W | ~100–500/day in P1 |
| NFR-SCALE-03 | Scale | 1,000+ scheduled posts/day. | W | ~50–100/day in P1 |
| NFR-SCALE-04 | Scale | Concurrent workflow execution, queue mgmt, horizontal scaling. | S | n8n queue mode + Redis/BullMQ in P1; HPA later |
| NFR-PERF-01 | Performance | Dashboard p95 < 500ms for reads. | S | P1 |
| NFR-PERF-02 | Performance | Generation pipeline bounded latency + timeouts per stage. | M | P1 |
| NFR-PERF-03 | Performance | Idempotent publish (no duplicate posts on retry). | M | P1 |
| NFR-SEC-01 | Security | Encrypted secrets at rest (KMS/vault), no plaintext API keys/OAuth tokens. | M | P1 |
| NFR-SEC-02 | Security | RBAC + tenant isolation enforced at query layer. | M | P1 |
| NFR-SEC-03 | Security | Audit logs, rate limiting on APIs. | M/S | P1 |
| NFR-SEC-04 | Security | Content moderation / safety gate on generated media. | M | P1 |
| NFR-SEC-05 | Security | OAuth token refresh + revocation handling. | M | P1 |
| NFR-AVAIL-01 | Availability | Graceful degradation if an AI/publish provider is down (fallback chain). | S | P1 |
| NFR-AVAIL-02 | Availability | Backup + disaster recovery for Postgres + assets. | S | P2 |
| NFR-AVAIL-03 | Availability | Target uptime 99.5% (single-region) MVP; 99.9% later. | S | P2 |
| NFR-COST-01 | Cost | Per-run + per-tenant cost tracking; budget caps to prevent blowup. | M | P1 |
| NFR-COST-02 | Cost | Model routing (cheap model for drafts, premium for finals). | S | P2 |
| NFR-MAINT-01 | Maintainability | Adapter pattern for every provider (LLM/image/video/publish/storage). | M | P1 |
| NFR-MAINT-02 | Maintainability | Config in DB, not hardcoded. | M | P1 |
| NFR-MAINT-03 | Maintainability | Modular n8n workflows (not one monolith). | M | P1 |
| NFR-MAINT-04 | Maintainability | Clean architecture / DDD boundaries; typed contracts. | S | P1 |
| NFR-COMPLY-01 | Compliance | GDPR/data-retention for brand + audience data; platform ToS adherence. | S | P2 |
| NFR-COMPLY-02 | Compliance | AI-content disclosure where platforms require it. | S | P2 |
| NFR-PORT-01 | Portability | Cross-platform (Windows dev / Linux prod), Docker + K8s-ready. | S | P1 Docker; P3 K8s |

---

## 3. MoSCoW Summary (MVP)

- **Must (ship P1):** Brand CRUD + identity + voice + social OAuth; DB-driven scheduling (one-time + tz); single-agent research brief; platform-specific text + caption + basic image generation; grammar + brand-compliance + QA-score review gate; human approval queue; publishing to **2 platforms** with validation/verify/retry/idempotency; in-dash + email notifications; core dashboard nav + workflow monitor + logs; auth + 4 roles + tenant isolation; structured per-run logging with cost/token; adapter pattern; modular n8n; encrypted secrets; moderation gate; per-run cost tracking.
- **Should:** Recurring campaigns, content calendar, Google Drive, richer research sources, more review stages, analytics dashboards, usage metering, more image types, Slack/Discord/Telegram.
- **Could:** Character library, prompt-optimizer/cost-optimizer agents, optimal-send-time, accessibility checks, reports export.
- **Won't (MVP):** All video/voice/subtitle/GIF/music generation, 500-tenant scale, full billing/Stripe, K8s autoscaling, the full 24-agent roster, competitor scraping.

---

## 4. Recommended MVP (Phase 1) — "Smallest Lovable Product"

**Goal:** Prove the **core loop end-to-end for ONE brand on 2 platforms with human approval**, at small scale, with real cost visibility.

**MVP scope (the loop):**
`Topic/brief → 1 research agent (LLM + web search) → platform-specific copy + caption + 1 image → automated review (grammar + brand-compliance + composite score, auto-regen if <threshold) → human approval queue → schedule → publish to 2 platforms → verify + store post URL/ID → pull basic per-post metrics → show on dashboard.`

**Platform choice for MVP (deliberate):** pick the **2 with the least painful publishing APIs** — realistically **X (has a paid but usable write API)** + **one of Facebook/Instagram (Meta Graph API)**. **Avoid LinkedIn** (Partner Program gate) and **TikTok/YouTube** (tight quotas, long approval) for MVP; add them in P2 once partner access is secured.

**MVP explicitly excludes:** video/voice/subtitles/GIFs, the full 24-agent set (ship ~6 agents), 500-tenant scale (design multi-tenant but run 5–20 brands), billing/Stripe, K8s, competitor scraping, most research sources, most review stages.

**Definition of Done for MVP:** a marketing manager can onboard a brand, connect 2 social accounts, request content on a topic, watch it get researched/generated/reviewed, approve it, and see it auto-published on schedule with a real post URL and a metrics row — with every step logged and cost-tracked.

### Phasing

- **Phase 1 (MVP, ~2–3 months):** the loop above.
- **Phase 2 (~3–4 months):** recurring campaigns + calendar, Google Drive, richer research + review stages, analytics dashboards + optimization inputs, Slack/Discord/Telegram, usage metering + budget caps, +2 platforms (LinkedIn once partnered, Meta IG), more image types, character library, model routing.
- **Phase 3 (~4–6 months):** video/voice/subtitle/GIF pipeline (highest cost/moderation risk), full billing/Stripe, 500-tenant hardening + K8s autoscaling, full agent roster, cost/prompt optimizers, reports export, DR/backup automation.

---

## 5. Competitor Benchmark

Research (July 2026) across the named comparators:

| Product | What it is | Imitate | Skip / de-emphasize |
|---|---|---|---|
| **Buffer** | Lightweight scheduler + AI drafting + basic analytics for small teams. | Clean scheduling UX, low-friction onboarding, "repurpose top post". | Enterprise workflow depth. |
| **Hootsuite** | Broadest suite; 150+ integrations; OwlyWriter AI captions + AI content calendar suggesting post times from engagement. | Integration breadth, AI-suggested calendar/send-times, unified inbox. | Trying to match 150 integrations early. |
| **Sprout Social** | Deepest team collaboration: advanced **approval workflows, granular roles, collision detection, team performance reports**, sentiment/listening. | Approval workflow + RBAC + collision detection = the collaboration bar to hit. This maps directly to our review/approval/RBAC requirements. | Deep social-listening/sentiment (heavy, later). |
| **HubSpot** | Social is a **module inside Marketing Hub**, tied to CRM; schedule/publish/monitor + analytics tied to conversions/CRM. | Analytics tied to downstream outcomes; treating social as one channel in a campaign. | Full CRM — out of scope. |
| **Jasper** | **Agentic marketing platform**: 100+ purpose-built agents, **Brand Voice / Jasper IQ** (tone + messaging pillars + ICP/persona knowledge), Content Pipelines (idea→publish), Optimization Agent (SEO/GEO). | Brand Voice as a first-class, reusable object; multi-agent orchestration; content pipelines. This validates our brand-profile + agent-pipeline design. | 100-agent breadth up front — start with ~6. |

**Architecture patterns worth imitating:** (1) **Brand Voice as a configured, reusable object** (Jasper) feeding every generation; (2) **approval workflow + granular RBAC + collision detection** (Sprout) as the collaboration core; (3) **AI-suggested calendar/optimal send times from engagement data** (Hootsuite); (4) **analytics tied to outcomes** (HubSpot); (5) **agent/pipeline orchestration** (Jasper) — but as a small, well-instrumented set, not 24–100 agents on day one.

**Key takeaway:** None of the incumbents lead with **AI video generation** — it's rare, expensive, and moderation-heavy. Our differentiator (full multi-brand video pipeline) is also our biggest risk; treat it as a Phase-3 bet, not an MVP feature.

**Sources:** Hootsuite/Buffer/Sprout comparisons and Jasper 2026 reviews (searchlab, genesysgrowth, sproutsocial, eesel.ai, agentiveaiagents) — see Section 8.

---

## 6. Risks, Ambiguities, Gaps & Open Questions

### 6.1 Top Risks (ranked)

1. **Platform API access & quotas (EXISTENTIAL).** LinkedIn publishing is gated behind the **Partner Program** (formal application, not self-serve). X now bills per-post and caps unverified accounts (~50 posts/day). TikTok Content Posting API ~15–25 videos/day/account and 6 req/min. YouTube quota increases take 3–4 weeks with no guarantee. **The "1,000 posts/day across 500 companies auto-publishing" target may be physically impossible under 2026 platform rules** without per-brand partner approvals and paid tiers. *This can invalidate the business model — must be validated first.*
2. **AI video cost blowup.** 2026 video APIs run **$0.05–$0.75/sec** (Veo Standard ~$0.40/s w/ audio, Sora 2 Pro ~$0.75/s, Kling ~$0.10/s). At "10k assets/day" including video, cost could reach **thousands of dollars/day** uncontrolled. Requires hard budget caps, model routing, and probably making video a premium add-on — not default.
3. **Content moderation & legal liability.** Auto-generating images of "characters" (doctors, executives, "fashion models") and auto-publishing to real brand accounts with no human in the loop risks: brand-damaging output, platform policy violations, copyright/likeness issues, and defamation/false-claims via unchecked "fact" content. The prompt's own "avoid inappropriate imagery" rule needs an enforced moderation gate + human approval, not just a negative prompt.
4. **Automation-vs-approval tension (contradiction in the prompt).** It asks for both "minimal human intervention / automatic publishing / Auto Mode" **and** "never publish immediately / multi-stage review / approval queue." These conflict. Needs an explicit **trust-tier policy** (e.g., manual → assisted → auto-per-brand after N successful reviews).
5. **Scale-vs-effort mismatch.** 500 tenants / 10k assets / 1k posts per day is a mature-product scale bolted onto a greenfield build. Building for it up front wastes months; ignoring it forces a rewrite. Resolve by **designing multi-tenant + queue-based from day one but only load-testing to real early numbers**.

### 6.2 Additional Risks

6. **Research-source ToS/legality** — scraping competitor posts, Reddit, LinkedIn/X trends may violate ToS or need paid data APIs (many free scrapes broke in 2026).
7. **AI provider volatility** — model deprecation, price changes, rate limits; the adapter/fallback-chain design is essential, not optional.
8. **Duplicate-publish / idempotency** — retries must not double-post; needs idempotency keys + verification.
9. **Cost/latency of "regenerate if score <90"** — an unbounded regen loop can burn money; must cap retries.
10. **n8n as the orchestration core at 1k+ posts/day** — must run queue mode + workers; a monolithic workflow won't survive (the prompt already warns against this).
11. **OAuth token lifecycle at scale** — hundreds of brand accounts × multiple platforms = constant token refresh/expiry/revocation handling.
12. **Multi-tenant data isolation** — a single missing tenant filter leaks one brand's assets/analytics to another.

### 6.3 Ambiguities / Gaps in the Prompt

- No **acceptance criteria, SLAs, or success metrics** defined for any feature.
- No **budget ceiling** — critical given per-second video and per-post X billing.
- "**Score < 90**" — 90 on what rubric, weighted how, measured by which model? Undefined and non-deterministic.
- **Auto vs manual publishing policy** left contradictory (see risk #4).
- **Data ownership / retention / GDPR** for brand + audience data unspecified.
- **Which 2 platforms first** and **which regions/timezones** unspecified.
- **Character/likeness rights** for AI-generated people unspecified.
- **n8n vs application-code boundary** — what logic lives in n8n vs the Node/Express backend is undefined (risk of duplicated orchestration).
- **Single-region vs multi-region**, and **self-hosted vs managed** for Postgres/Redis/n8n — unspecified, affects availability NFRs.

### 6.4 Open Questions for the User (must answer before full build)

1. **Which 2 platforms for the MVP**, and do you already have (or can you get) API partner/paid access for them? (Especially: is LinkedIn or TikTok mandatory? — they're gated.)
2. **What is the monthly AI budget ceiling**, and should video be a paid add-on rather than a default capability?
3. **Auto-publish policy:** fully automatic, always human-approved, or a per-brand trust tier? (Resolves the core contradiction.)
4. **Is AI video generation in-scope for v1**, or acceptable to defer to Phase 3? (Strong recommendation: defer.)
5. **Realistic launch scale:** how many brands and posts/day in the first 3 months? (500/10k/1k is a Year-2 target, not launch.)
6. **What defines the "90" quality score** — do you have a rubric, or should we define one?
7. **Hosting model:** self-hosted VPS/K8s vs managed cloud; single-region acceptable for MVP?
8. **Legal posture** on AI-generated people/characters and AI-content disclosure — any brand or regulatory constraints?
9. **Data residency / GDPR** requirements for the brands you'll onboard?
10. **Build vs buy** for research data (pay for trend/SERP/social-listening APIs vs scrape)?

---

## 7. Effort / Complexity Sizing & Build Sequence

### 7.1 T-shirt sizing per domain (MVP-portion effort)

| Domain | MVP complexity | Full-vision complexity |
|---|---|---|
| Auth + RBAC + multi-tenancy | M | L |
| Brand management | M | L |
| Scheduling engine | M | L |
| Research (1 agent → 18 sources) | S | XL |
| Text/image generation + adapters | L | XL |
| Video/voice/subtitle pipeline | — (deferred) | XXL |
| Review/QA + scoring + approval | M | L |
| Publishing + platform adapters + queue | L | XL |
| Analytics | S | L |
| Notifications | S | M |
| Dashboard/UX (20+ items) | L (core subset) | XL |
| Billing | — (deferred) | L |
| Observability/logging/cost | M | L |
| n8n orchestration (modular, queue mode) | M | XL |

### 7.2 Phase sizing

- **Phase 1 (MVP):** **L–XL**, ~2–3 months, 2–3 engineers. The core loop for 1 brand / 2 platforms.
- **Phase 2:** **XL**, ~3–4 months. Multi-source research, richer review, calendar, Drive, analytics, metering, +2 platforms, more image types.
- **Phase 3:** **XXL**, ~4–6 months. Video/voice pipeline, billing, 500-tenant hardening, K8s, full agent roster, DR.
- **Total to full vision:** **~12–18 months** with a small team — consistent with the prompt's own framing.

### 7.3 Recommended build sequence

1. **De-risk first (Week 0–2, before heavy build):** confirm platform API access for the 2 MVP platforms; confirm AI budget ceiling; lock the auto-vs-approval policy; define the quality rubric. *These are cheap to answer and expensive to get wrong.*
2. **Foundation:** monorepo, Docker Compose (Postgres, Redis, n8n queue mode), auth + tenant model + RBAC, adapter/config-in-DB scaffolding, structured logging + cost tracking.
3. **Brand + scheduling:** brand CRUD/identity/voice, social OAuth (2 platforms), DB-driven scheduler + timezone.
4. **Generation core:** provider-abstracted LLM (1–2 providers) + 1 image provider; ~6 agents (research, copywriter, brand-compliance, grammar, image-prompt, QA-scorer) on a standard I/O contract with retry/fallback.
5. **Review + approval:** automated gate + composite score + bounded auto-regen + human approval queue + bulk actions.
6. **Publishing:** platform adapters, media validation, idempotent publish, verify, retry/dead-letter, rate-limit-aware throttling, publishing queue controls + emergency stop.
7. **Feedback:** basic analytics pull + storage + dashboard surfacing; workflow monitor + logs views.
8. **Harden:** moderation gate, secrets encryption, audit logs, notifications (in-dash + email), cost caps, small-scale load test.
9. **Then** iterate into Phase 2/3 per the phasing above, gating video behind explicit budget approval.

---

## 8. Sources

- [Hootsuite vs Buffer vs Sprout Social (2026) — Searchlab](https://searchlab.nl/en/compare/hootsuite-vs-buffer-vs-sprout-social)
- [OwlyWriter vs Buffer AI vs Sprout Social AI (2026) — Genesys Growth](https://genesysgrowth.com/blog/hootsuite-owlywriter-vs-buffer-ai-vs-sprout-social-ai)
- [Sprout Social vs Hootsuite (2026) — Sprout Social](https://sproutsocial.com/insights/sprout-social-vs-hootsuite/)
- [Jasper AI Review 2026 — eesel AI](https://www.eesel.ai/blog/jasper-ai-review-2026)
- [Jasper AI: The Agentic Marketing Platform (2026)](https://agentiveaiagents.com/jasper-ai-review-agentic-marketing-platform/)
- [TikTok API Rate Limits 2026 — Phyllo](https://www.getphyllo.com/post/tiktok-api-rate-limits-in-2026-quotas-errors-workarounds)
- [Social Media API Rules: Limits & Specs (2026) — Postproxy](https://postproxy.dev/blog/social-media-platform-api-rules-rate-limits-media-specs/)
- [Social Media APIs in 2026: Real Costs, Rate Limits & What Broke — Socialcrawl](https://www.socialcrawl.dev/blog/ultimate-guide-social-media-apis-2026)
- [X (Twitter) API Posting Limits 2026 — Sorsa](https://api.sorsa.io/blog/twitter-api-posting-limits)
- [AI Video Generation API Pricing (July 2026) — BuildMVPFast](https://www.buildmvpfast.com/api-costs/ai-video)
- [AI Video Pricing Explained (2026) — Rangy](https://rangy.ai/blog/ai-video-pricing-explained/)
