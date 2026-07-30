# AI Generation Stack — Research & Adapter Design

**Project:** Enterprise AI Marketing Automation Platform
**Scope:** text · images · video · GIFs · voiceovers · subtitles · captions across many brands at scale (**10k assets/day** target)
**Author role:** Senior AI Engineer
**Date:** 2026-07-30
**Method:** Web research (WebSearch/WebFetch) + live pricing from the connected `fal` MCP catalog. Verified, not guessed.

> **Pricing caveat (read first):** Anthropic numbers are authoritative (internal catalog). `fal.ai` numbers marked *(fal live)* were pulled from the connected `fal` MCP on 2026-07-30 and are exact for those endpoints. All other third-party pricing is from vendor/aggregator pages that move frequently — treat as directional and re-confirm against the provider's own pricing page before committing volume budgets. Enterprise volume (10k/day) warrants negotiated committed-use rates below the PAYG list prices shown.

---

## 0. Executive Summary

- **Text (LLM):** Build a provider-abstraction layer keyed on `task`, not `model`. Route **copywriting → Claude Sonnet 4.6**, **QA/brand-compliance review → Claude Opus 4.8 / o4-mini**, **bulk tagging/hashtags/classification → Gemini 2.5 Flash-Lite (batched) / Groq Llama 3.1 8B**. Use **prompt caching** on the frozen brand-book prefix — the single biggest LLM cost lever for a multi-brand pipeline.
- **Images:** Start managed via the connected **`nano-banana-2` MCP** + **Ideogram v3 / Seedream 4.0** for text-heavy posters; **FLUX Kontext** for in-image text edits. At steady 10k/day volume, self-host **ComfyUI + Flux/SDXL on a rented A100/L40S** for bulk non-text assets (10–30× cheaper/image).
- **Video:** **All 7 requested models expose a real programmatic API in 2026** — none is UI-only anymore. MVP = **Google Veo 3.1 Fast/Lite** (one first-party call yields a finished clip *with synced audio*). Scale = **fal.ai as a single integration surface** routing Seedance (cheap silent B-roll), Runway Gen-4 (fast), Veo/Kling (hero + audio).
- **Voice/subtitles:** **ElevenLabs** (connected MCP) for hero voiceovers; Google Neural2/Azure Neural for the cheap high-volume tier. **Get subtitle timing from the TTS `with-timestamps` response — skip STT entirely.** Fallback: self-hosted faster-whisper.
- **Music:** **Suno has no production public API in 2026.** The connected `suno` MCP works operationally through Suno's own auth, but do **not** architect a scaled backend on it. For licensed API music use **ElevenLabs Music**.
- **Biggest warnings:** (1) Suno API gap; (2) **GPT Image API removal announced Dec 1 2026** — don't make it a core dependency; (3) every video model caps at 5–10s/gen → design around stitched segments; (4) only Veo 3.1 / Runway / Kling 2.6+ have **native audio** — the rest need a separate TTS/music stage.

---

## 1. LLM Providers (Text)

### 1.1 Per-provider findings (mid-2026)

**OpenAI** — Flagship GPT-5.5/5.6 line; GPT-4.1 kept as cheaper non-reasoning workhorse; o-series (o3/o4-mini/o3-pro) for reasoning. Two API surfaces: **Responses API** (recommended, semantic streaming) and **Chat Completions** (de-facto standard others emulate). Streaming, tool/function calling, **automatic prompt caching** (75–90% off repeated prefixes). Batch/Flex = flat 50% off. *Watch-out:* o-series bills hidden thinking tokens at the **output** rate, so QA cost > sticker.

**Anthropic Claude** *(authoritative)* — Single `POST /v1/messages` endpoint. Streaming, parallel tool use, structured outputs (`output_config.format`), Batch API (50% off). **Prompt caching is the differentiator:** explicit `cache_control` breakpoints (max 4), 5-min TTL (write 1.25× base, read ~0.1×) or 1-hr TTL (write 2×, read ~0.1×); break-even ~2 requests. **Strongest for creative/brand-voice copy.** Current defaults per internal catalog: `claude-opus-4-8` flagship, adaptive thinking (`thinking:{type:"adaptive"}`); `budget_tokens` removed on 4.7/4.8; assistant-prefill unsupported on 4.6+/Fable.

**Google Gemini** — Gemini 3 Pro flagship; 2.5/3.6 Flash mid; **2.5 Flash-Lite cheapest tier**. Streaming, tool calling, **explicit context caching** (reads at 10% of base input) but with a **per-hour storage fee ($1–$4.50 / 1M tokens/hr)** unlike OpenAI/Anthropic. Batch mode cuts further (Flash-Lite → ~$0.05 in / $0.20 out). **Flash-Lite is the price-performance winner for bulk.**

**Groq** — Ultra-low-latency **LPU** inference, open-weight models only (Llama/Qwen/GPT-OSS). Llama 3.1 8B ~840 TPS. Batch 50% off; prompt caching halves input on hits (no extra fee). **Llama 3.1 8B at $0.05/$0.08 + 840 TPS is arguably the cheapest+fastest bulk option** — cheaper than the electricity to self-host it.

**OpenRouter** — Unified OpenAI-compatible gateway to 300+ models, one key/balance/bill. Pays underlying rate **+ ~5.5% fee** (5% enterprise). Built-in automatic cross-provider **fallback**. *Caveat:* default routing can silently fail over to a more expensive provider — pin providers / set price ceilings. Best used **as the failover layer** for non-critical paths.

**Local Ollama** — Self-host open weights on own GPU. VRAM rule (Q4): 8GB→7–8B, 16GB→13–14B, 24GB→32B, ~40GB→70B. Box ~$1.5–4k upfront + $50–300/mo power. **Break-even:** <50M tok/mo → APIs win; ~50–100M/mo to justify vs budget APIs; weeks vs frontier APIs at high volume. For ~10k assets/day it's **borderline** — pilot only the bulk-classification leg, and only if privacy/residency demands it.

### 1.2 LLM $/1M-token comparison

| Provider | Model | $/1M in | $/1M out | Best-fit role |
|---|---|---|---|---|
| Anthropic | Claude Fable 5 | $10.00 | $50.00 | Premium reasoning |
| Anthropic | Claude Opus 4.8 | $5.00 | $25.00 | Flagship QA + hero copy |
| Anthropic | **Claude Sonnet 4.6** | $3.00 | $15.00 | **Copywriting (value)** |
| Anthropic | Claude Haiku 4.5 | $1.00 | $5.00 | Cheap review |
| OpenAI | GPT-5.5 | $5.00 | $30.00 | Hard reasoning |
| OpenAI | GPT-5.4 | $2.50 | $15.00 | General copy/review |
| OpenAI | GPT-5.4 Mini | $0.75 | $4.50 | Cheap review |
| OpenAI | o4-mini | $1.10 | $4.40 | Cheap reasoning QA |
| OpenAI | GPT-4.1 Nano | $0.10 | $0.40 | Bulk tagging |
| Google | Gemini 3 Pro | $2.00–4.00 | $12–18 | Cheaper flagship reasoning |
| Google | Gemini 2.5 Flash | $0.15 | $1.25 | Cheap copy/review |
| Google | **Gemini 2.5 Flash-Lite** | $0.10 ($0.05 batch) | $0.40 ($0.20 batch) | **Bulk (cheapest)** |
| Groq | **Llama 3.1 8B** | $0.05 | $0.08 | **Bulk (cheapest + ~840 TPS)** |
| Groq | Llama 3.3 70B | $0.59 | $0.79 | Fast mid-tier open |
| OpenRouter | (any) | provider +~5.5% | provider +~5.5% | Gateway / failover |
| Ollama | Qwen3.5-9B etc. | fixed HW cost | fixed HW cost | Private/high-volume bulk |

### 1.3 Provider-abstraction layer design

**Common interface** — a single provider-agnostic `LLMClient` facade:

```
generate(task, prompt, system, schema?, max_tokens) -> Result
stream(task, prompt, system, ...)                    -> AsyncIterator<Chunk>
call_tool(task, prompt, tools[], ...)                -> ToolResult
```

- Adapters translate the normalized request to each provider (Anthropic Messages / OpenAI Responses+Chat / Gemini / Groq/OpenAI-compatible).
- **`task` is a first-class routing key** (`copywriting | qa_review | bulk_classify`), resolved to `model → provider` via a **config/DB table** (hot-reloadable) — re-route without touching call sites. This satisfies the prompt's "every AI provider replaceable through adapters" + "store configuration in the database" principles.
- Return a **normalized `Result`** (text, usage tokens, cache-hit tokens, provider, model, computed cost) so every call feeds unified cost/observability logging (the prompt's Logging section: model, execution time, token usage, cost).

**Fallback chain** — per task, an ordered provider list; on 429 / 5xx / refusal / timeout, advance to the next entry. Build it in-layer for primary paths (cost control), optionally delegate to **OpenRouter** for breadth on non-critical paths.

**Prompt-caching strategy (biggest lever)** — put the **stable brand context first, volatile brief last**. The brand book / tone rules / few-shot exemplars go in a **cached prefix**; the per-asset brief goes after the last cache breakpoint. The same brand context repeats across thousands of assets → huge savings.
- Anthropic: explicit `cache_control` on last system block; 1-hr TTL for frozen brand prefix (re-warm before expiry), 5-min for session context.
- OpenAI: automatic prefix caching — keep prefix byte-stable (no timestamps/UUIDs in system prompt).
- Gemini: explicit context caching but factor the per-hour storage fee — worth it only at high read volume.
- **Invariant:** any byte change in the prefix invalidates the cache. Freeze the system prompt; inject dynamic data after the breakpoint.

**Concrete task → model routing table**

| Task (maps to prompt's AI agents) | Primary | Fallback 1 | Fallback 2 | Rationale |
|---|---|---|---|---|
| **Copywriting (hero/brand)** — Copywriter, Script Writer | Claude Sonnet 4.6 | Claude Opus 4.8 | GPT-5.4 | Best brand voice; Sonnet = value, Opus for flagship |
| **Copywriting (bulk variants)** — platform-specific posts | Gemini 2.5 Flash | Claude Haiku 4.5 | GPT-5.4 Mini | Cheap, fast, good-enough drafts at volume |
| **QA / fact-check / brand-compliance** — Fact Checker, Brand Compliance, QA Agent | Claude Opus 4.8 | o4-mini | Gemini 3 Pro | Review rigor + scoring; cheaper reasoning fallbacks |
| **QA (lightweight scoring)** — Grammar, review-score gate (<90 → regen) | GPT-5.4 Mini | Claude Haiku 4.5 | Gemini 2.5 Flash | Cheap structured scoring |
| **Bulk classify / tag / hashtags** — Hashtag Generator, SEO Agent | Gemini 2.5 Flash-Lite (batch) | Groq Llama 3.1 8B | GPT-4.1 Nano | Cheapest + fastest |
| **Bulk (privacy/residency)** | Ollama Qwen3.5-9B | Gemini Flash-Lite | — | Only if privacy/volume justify self-host |

Design guidance: app-level exponential backoff + fallback advance; **structured outputs** for QA scoring/classification (machine-parseable); emit per-call cost + cache-hit metrics on every provider; use **Batch API (50% off)** for the nightly bulk-classification run.

---

## 2. Image Models

### 2.1 Access classification & cost (per 1024² image unless noted; USD)

| Model / variant | Access | Cost/image | Text-in-image | Notes |
|---|---|---|---|---|
| **FLUX.2 [pro]** (BFL) | Native BFL API + fal + Replicate | ~$0.03/MP | Excellent (brand/logo/layout) | Flagship (Nov 2025) |
| FLUX.1 [pro] v1.1 | BFL + **fal** + Replicate | **$0.04/MP** *(fal live)* | Very good | Prev-gen workhorse |
| FLUX.1 [pro] v1.1-ultra | fal | **$0.06/image** *(fal live)* | Very good | Higher-res |
| FLUX [dev] | Self-host; fal hosts | **$0.025/MP** *(fal live)* / ~$0.0004 self-host | Very good | Open-ish weights |
| FLUX.1 **Kontext** [pro]/[max] | BFL + fal + Replicate | $0.04 / $0.08 | Good (in-image edits) | **Image editing** — localize/swap copy |
| **SDXL** (fast-sdxl) | Open weights; **fal**/Replicate | **$0.00125/compute-sec** *(fal live)* (~$0.003–0.01/img managed); ~$0.0004 self-host | Weak (needs LoRA/composite) | **Cheapest at scale** |
| **Ideogram v3** | Native API + **fal** + Replicate | **$0.03/image** *(fal live)* (Turbo); $0.06/$0.09 Default/Quality | **Best-in-class text** | Top pick for text-heavy posters |
| **GPT Image 1.5** (OpenAI) | Native OpenAI (+Azure) | $0.009 / $0.034 / $0.133 (low/med/high) | Excellent | ⚠️ **API removal announced Dec 1 2026** |
| **Nano Banana** (Gemini 2.5 Flash Image) | Gemini API / Vertex | $0.039 (batch $0.0195) | Very good | MCP available |
| **Nano Banana 2** (Gemini 3.1 Flash Image) | Gemini API / Vertex | $0.067 (1K) / $0.101 (2K) / $0.151 (4K); batch −50% | Excellent (sharper text) | **`nano-banana-2` MCP connected** |
| Imagen 4 Fast/Std/Ultra | Vertex AI only | $0.02 / $0.04 / $0.06 | Good–very good | Cheap first-party bulk |
| **Seedream 4.0** (ByteDance) | fal / Replicate / OpenRouter | **$0.03** (to 4K) | **Excellent, multilingual** | ~1.8s @2K; best price/perf/text |
| Seedream 5.0 Pro | fal / OpenRouter | ~$0.03+ | Best dense/multilingual text | Jul 2026; infographics |

### 2.2 ComfyUI — what it actually is

ComfyUI is a **self-hosted, node-based workflow ENGINE, not a model**. It orchestrates open-weight models (SDXL, Flux/Flux 2) on your own GPU: reproducible pipelines (generate → upscale → inpaint → composite text → brand overlay), LoRAs, ControlNet, batching. No hosted API of its own — you supply GPU + weights.

- **GPU rental (RunPod, verified Jul 2026):** L40S 48GB $0.99/hr · A100 80GB $1.39/hr · H100 PCIe $2.89/hr.
- **Per-image self-host (Flux):** local RTX 4090 ≈ **$0.0004/img**; rented A100 ≈ $0.002–0.004/img; fal managed Flux 2 dev ≈ $0.013/img.
- **Break-even ~30k–50k images/month.** At 10k/day (~300k/month) you are far past it — **self-host is 10–30× cheaper per image**.

### 2.3 Image recommendation (MVP → scale)

1. **MVP (managed, zero ops):** primary workhorse = **`nano-banana-2` MCP** (connected) at batch ~$0.033–0.05/img, excellent text. Add **Ideogram v3** ($0.03 Turbo, fal) or **Seedream 4.0** ($0.03) for the most text-critical posters/banners. Keep **FLUX.1 Kontext** ($0.04) for in-image text edits/localization (multi-language brand assets).
2. **Scale:** stand up **ComfyUI + Flux 2 / SDXL** on a dedicated A100/L40S for bulk backgrounds and non-text assets (~$0.002–0.004/img); route **only text-critical assets** to the managed text specialists. Prefer **Vertex AI batch** for the Google path.
3. **Avoid as backbone:** GPT Image 1.x (announced Dec 1 2026 API removal) — tactical use only.

**Rough daily image cost at 10k/day:** all-managed @$0.03 ≈ **$300/day**; @$0.06 ≈ $600/day; **self-hosted SDXL/Flux ≈ $30–100/day GPU** → hybrid is the enterprise answer.

---

## 3. Video Models — API automatability (the critical question)

**Finding: all 7 requested models expose a real programmatic API in 2026 — none is truly UI-only or waitlist-only anymore** (Pika's old "UI-only" reputation is outdated; it's now on fal.ai).

| Model | API-automatable? | How | Cost / ~5s | Latency | Max dur | Native audio |
|---|---|---|---|---|---|---|
| **Google Veo 3.1** | **Yes (best)** | Native Gemini API + Vertex; fal/Replicate — **$0.40/sec** *(fal live, veo3)* | $0.25 (Lite) – $2.00 (Std) | 0.5–4 min | 8s/gen | **Yes** |
| **Runway Gen-4** | **Yes (mature)** | Native Dev API; fal/Replicate | **$0.25** (Turbo) | **~30s** | 10s/gen | Yes (newer) |
| **Kling 3.0** | Yes | **fal**/Replicate (native = big prepaid) — **$0.28/sec** *(fal live, v2 master)* | $0.18–1.70 | 1–4 min | 5–15s | Yes (2.6/3.0) |
| **Seedance 1.0** | **Yes (easiest)** | fal / Volcengine / Replicate — **$2.50/1M tokens** *(fal live, pro i2v)* | $0.18–0.75 | **<1 min** | 10s | No |
| **Hailuo 02 (MiniMax)** | Yes | Native REST / **fal** / Replicate — **$0.045/sec** *(fal live, standard i2v)* | $0.27–0.48 | 30–90s | 10s (1080p=6s) | No |
| **Pika 2.2** | Yes (via fal) | **fal.ai** / Replicate / Picsart | $0.20–0.45 | ~1 min | 5–10s | No |
| **Higgsfield** | Yes (rough native) | Native SDK / WaveSpeedAI / **MCP connected** | $0.13–0.56 | ~1–3 min | 5s | No |

### 3.1 Practical to automate vs avoid

- **Cleanest to automate:** **Veo 3.1** (native + audio), **Runway Gen-4** (native, fast, cheap), and **Seedance / Hailuo / Pika via fal.ai** (uniform REST/queue, per-second billing).
- **Automatable with caveats:** **Kling** — use fal/Replicate, **NOT** the native API (its ~$4.2k/3-month prepaid commitment is impractical for an MVP). **Higgsfield** — native API is developer-unfriendly (no webhooks/batch, credit expiry); use the **connected MCP** or WaveSpeedAI, and only for its niche cinematic camera-motion look (360 orbit, dolly, parallax).
- **Universal constraints:** all cap at **5–10s/gen** → design the pipeline around **stitched segments**; only **Veo 3.1 / Runway / Kling 2.6+** have **native audio** — Seedance/Hailuo/Pika/Higgsfield need a separate TTS/music stage; all use **async job patterns** (queue → poll/webhook).
- **Lifecycle flags:** Veo 3.0 endpoints sunset **Jun 30 2026** → build on Veo **3.1**; Runway Gen-3 Alpha Turbo sunset mid-2026 → use Gen-4/4.5.

### 3.2 Video recommendation

- **MVP (single model, fastest path):** **Google Veo 3.1 Fast/Lite** via Gemini API — one first-party call yields a finished clip **with synced audio**, minimal plumbing (~$0.25–0.50/5s). Fall back to Veo 3.1 Standard for hero clips.
- **Scale (cost-optimized, common layer):** standardize on **fal.ai** as the integration surface, route by job type:
  - Bulk silent B-roll / volume → **Seedance 1.0** (cheapest, <1 min) + separate TTS stage.
  - Fast social iterations w/ consistency → **Runway Gen-4 Turbo** (~$0.25, ~30s).
  - Hero/premium ad creative w/ audio → **Veo 3.1 Standard** or **Kling 3.0**.
  - Cost-efficient I2V social → **Hailuo 02 / Pika 2.2**.
  - Signature cinematic camera moves → **Higgsfield** (connected MCP) as a stylistic accent, not a workhorse.

---

## 4. Voice / Music / Subtitles

### 4.1 Voiceover TTS (750 chars ≈ 1 min audio)

| Provider / model | $/1,000 chars | ~$/min | Notes |
|---|---|---|---|
| Google Standard/WaveNet | $0.004 | $0.003 | Cheapest, robotic |
| Cartesia Sonic (low) | ~$0.005 | ~$0.004 | ~40ms latency leader |
| Azure commitment tier | $0.0075 | $0.006 | Volume-negotiated |
| OpenAI tts-1 / 4o-mini-tts | $0.015 | $0.011 | No cloning, preset voices |
| **Google Neural2 / Azure Neural** | $0.016 | **$0.012** | **Best price/quality — high-volume tier** |
| OpenAI tts-1-hd / Google Chirp3 HD | $0.030 | $0.023 | HD preset |
| **ElevenLabs Flash v2.5 / Turbo** | $0.050 | $0.038 | ~75ms, cloning, MCP connected |
| **ElevenLabs Multilingual v2/v3** | $0.100 | $0.075 | Best quality, ~32 langs, pro cloning |

- **ElevenLabs** (connected MCP): full REST + streaming, credit-based, instant cloning (Starter $6), pro cloning (Creator $22), ~32 languages. **At 10k min/day (~7.5M chars/day):** ElevenLabs Multilingual ≈ $750/day, Flash ≈ $375/day, Google Neural2/Azure ≈ $120/day → negotiate committed-use rates.
- **Recommendation:** ElevenLabs (MCP) for hero/brand voiceovers + cloning; **Google Neural2 / Azure Neural (~$0.012/min)** as the high-volume cost tier; Cartesia Sonic if ultra-low latency matters.

### 4.2 Music — Suno & alternatives

- **Suno has NO official public API as of July 2026** — web app + curated partner beta only; no endpoints/docs/pricing. Third-party wrappers are unofficial with ToS/licensing risk — **not enterprise-grade for 10k/day**. Commercial rights only on paid tiers.
- The connected **`suno` MCP works operationally** through Suno's own auth, so it's usable for the platform, but there is **no self-service commercial API to build a scaled backend on**.
- Udio is also non-viable (post-UMG settlement: licensed walled garden, API waitlist-only).
- **For API-first licensed music at scale, use ElevenLabs Music.**

### 4.3 Subtitles / captions (per minute of audio)

| Service / model | $/min | Word timestamps | SRT/VTT | Self-host |
|---|---|---|---|---|
| **AssemblyAI** (async Universal-2) | **$0.0025** | Yes | Yes | No |
| Deepgram Nova-3 (batch) | $0.0043 | Yes | Yes (native) | Enterprise |
| OpenAI `whisper-1` | $0.006 | Yes | **Yes** (srt/vtt) | No |
| OpenAI `gpt-4o-transcribe` / mini | $0.006 / $0.003 | **No** | **No (JSON only)** | No |
| **faster-whisper** (self-host) | **$0 + compute** | Yes (native) | Yes | **Yes** |

- **Caveat:** OpenAI's new `gpt-4o-transcribe`/mini return **JSON only — no SRT/VTT, no timestamps**; for OpenAI captions you must use older `whisper-1`.
- **Best shortcut:** since the platform generates its own voiceovers, get caption timing **directly from the TTS response** — **ElevenLabs `/text-to-speech/:voice_id/with-timestamps`** returns per-word/char start/end times, built for auto-subtitles. More accurate than transcribing (source text is known) and **zero extra STT spend**. Fallback: self-hosted **faster-whisper** (cheapest at scale) or **AssemblyAI batch** ($0.0025/min).

---

## 5. Connected MCP Servers as Ready Integration Points

The environment already has these MCP servers connected — they map cleanly onto the generation adapters, so the platform can wire them as **ready-made adapter backends** and skip the initial credential/SDK plumbing:

| MCP server | Generation adapter it serves | Role in stack |
|---|---|---|
| **`fal`** | Image + Video (unified) | **Single integration surface** for Flux/SDXL/Ideogram/Seedream (image) and Veo/Kling/Seedance/Hailuo/Pika (video). Live catalog + pricing + generate/status/result. The scale-phase backbone. |
| **`nano-banana-2`** | Image (text-heavy) | Primary MVP image workhorse — generate/edit/continue-editing, strong in-image text for posters/banners. |
| **`google-veo-3-1`** | Video | MVP video model — finished clips with synced audio in one call. |
| **`higgsfield`** | Video (cinematic motion) | Stylistic accent adapter — camera-motion presets on stills. |
| **`elevenlabs`** | Voiceover + Subtitle timing | Hero voiceovers, cloning, and `with-timestamps` for zero-cost captions. |
| **`suno`** | Music (operational only) | Usable via its own auth for background music, but not a scalable commercial API — keep behind a music adapter with ElevenLabs Music as the API-first alternative. |

**Design implication:** each MCP becomes one concrete implementation behind the adapter interface (§6). The abstraction still routes by `task/cost`, so an MCP-backed adapter (e.g. `fal`) and a direct-SDK adapter (e.g. Vertex batch) are interchangeable per the DB-driven routing config.

---

## 6. Capability + Cost Matrix (consolidated)

| Modality | Recommended primary (MVP) | Scale / cost tier | Access | Unit cost | Notes |
|---|---|---|---|---|---|
| **Text — copywriting** | Claude Sonnet 4.6 | Gemini 2.5 Flash (bulk variants) | API | $3/$15 per 1M | Best brand voice; cache brand prefix |
| **Text — QA/review** | Claude Opus 4.8 | o4-mini / Gemini 3 Pro | API | $5/$25 per 1M | <90 score → regenerate loop |
| **Text — bulk tag/hashtag** | Gemini 2.5 Flash-Lite (batch) | Groq Llama 3.1 8B | API | $0.05–0.10/1M in | Batch 50% off |
| **Image — text-heavy** | nano-banana-2 (MCP) / Ideogram v3 | Seedream 4.0 | MCP / fal / Vertex | $0.03–0.05/img | Posters, banners, thumbnails |
| **Image — bulk/backgrounds** | Imagen 4 Fast / SDXL (fal) | **ComfyUI + Flux/SDXL self-host** | Vertex / fal / GPU | $0.02 mgd → $0.002–0.004 self-host | 10–30× cheaper self-hosted at 10k/day |
| **Image — editing/localize** | FLUX.1 Kontext | FLUX.1 Kontext | fal / BFL | $0.04–0.08/img | In-image text swap per language |
| **Video — MVP (w/ audio)** | Veo 3.1 Fast/Lite | Veo 3.1 Std (hero) | Gemini API / MCP / fal | $0.25–2.00 / 5s | One call = clip + synced audio |
| **Video — bulk silent** | Seedance 1.0 (fal) | Seedance 1.0 | fal | $0.18–0.75 / 5s | Add TTS stage; <1 min latency |
| **Video — fast social** | Runway Gen-4 Turbo | Runway Gen-4 | Native / fal | ~$0.25 / 5s | ~30s latency, consistency |
| **Voiceover** | ElevenLabs (MCP) | Google Neural2 / Azure Neural | MCP / API | $0.012–0.075 / min | Cheap tier 6× cheaper than EL |
| **Subtitles/captions** | ElevenLabs with-timestamps | faster-whisper (self-host) | MCP / self-host | $0 extra → $0.0025/min | Prefer TTS timestamps over STT |
| **Music** | Suno (MCP, operational) | ElevenLabs Music (API) | MCP / API | n/a public API | No scalable Suno API — flag |

---

## 7. MVP Stack vs Scale Stack

### 7.1 MVP generation stack (cheapest reliable path to prove the loop)

| Modality | MVP choice | Why |
|---|---|---|
| Copywriting | Claude Sonnet 4.6 (via abstraction layer) | Best brand voice at value price; cache brand prefix from day 1 |
| QA/review | GPT-5.4 Mini + Claude Opus 4.8 for final gate | Cheap structured scoring, one rigorous gate |
| Bulk tag/hashtag | Gemini 2.5 Flash-Lite (batch) | Cheapest, fully managed |
| Images | **`nano-banana-2` MCP** + Ideogram v3 for text posters | Zero ops, excellent text, MCP already connected |
| Image edits | FLUX.1 Kontext (fal) | Localization / copy swaps |
| Video | **`google-veo-3-1` MCP** (Fast/Lite) | Finished clip **with audio** in one call — no stitching/audio plumbing |
| Voiceover | **`elevenlabs` MCP** (Flash v2.5) | Quality + cloning, MCP connected |
| Subtitles | ElevenLabs with-timestamps | Zero extra cost, most accurate |
| Music | `suno` MCP (operational) | Good enough to prove loop; not scale backbone |

**MVP posture:** all managed / MCP-backed, no GPU ops. Proves the full research→generate→review→publish loop in days.

### 7.2 Scale stack (10k assets/day)

- **Text:** full task-routed abstraction layer with fallback chains + prompt caching + Batch API for bulk; add Groq Llama 8B for cheapest bulk.
- **Images:** **ComfyUI + Flux/SDXL self-hosted on rented A100/L40S** for bulk/backgrounds (~$0.002–0.004/img); managed text specialists (Ideogram/Seedream/nano-banana-2) only for text-critical assets; Vertex batch for Google path.
- **Video:** **fal.ai as single integration surface** routing Seedance (bulk silent) / Runway Gen-4 (fast) / Veo 3.1 + Kling 3.0 (hero + audio) by job type.
- **Voice:** ElevenLabs for hero, Google Neural2/Azure Neural for the high-volume tier; negotiate committed-use rates.
- **Subtitles:** ElevenLabs timestamps primary, faster-whisper self-host fallback.

---

## 8. Cost-Optimization Strategy at 10k Assets/Day

1. **Model routing by task tier (biggest lever).** Never use a flagship where a cheap model suffices. Copywriting → mid (Sonnet); QA scoring → cheap (GPT-5.4 Mini / Haiku); bulk tag/classify → cheapest (Flash-Lite / Groq 8B). Frontier models reserved for the final compliance gate and hero assets only.
2. **Prompt caching on the brand prefix.** Freeze brand book / tone / exemplars as a cached prefix (Anthropic explicit `cache_control` 1-hr TTL; OpenAI byte-stable prefix; Gemini context cache). Reads at ~10% of base input — dominant saving in a multi-brand, high-repetition pipeline.
3. **Batching.** Route the nightly bulk-classification / tagging run through **Batch APIs (50% off)** on OpenAI/Anthropic/Gemini/Groq, and image bulk through **Vertex batch (−50%)**. Latency-tolerant work should never pay real-time rates.
4. **Cheaper models for review passes.** The prompt's multi-stage review (grammar, SEO, duplicate, accessibility) mostly needs cheap structured scoring — run those on Flash/Mini and escalate only the brand-compliance + fact-check gate to Opus. Reserves ~$25/1M output spend for the few checks that need it.
5. **Self-hosting break-even (images/subtitles).** At 300k images/month you are 6–10× past the ~30–50k break-even → **self-host ComfyUI + Flux/SDXL** for bulk/non-text images (~$30–100/day GPU vs $300–600/day managed). Similarly **self-host faster-whisper** for any STT. Do **not** self-host the small bulk LLM (Groq serves Llama 8B cheaper than the electricity).
6. **Skip redundant stages.** Get subtitle timing from the **TTS `with-timestamps`** response instead of a separate STT pass — eliminates an entire cost line. Regenerate-on-<90 loop should cap retries (e.g. 2) to avoid runaway spend.
7. **Per-call cost telemetry + budget guardrails.** The normalized `Result` emits provider/model/tokens/cache-hits/cost per call → power the prompt's Logging + Cost Optimizer agent, set per-brand daily budget ceilings, and detect routing regressions.

**Illustrative daily envelope (directional):** images self-hosted ≈ $30–100 + managed text-critical images ≈ $50–150; video (mixed, ~1–2k clips) ≈ $300–800; voice (cheap tier) ≈ $120; text (routed + cached + batched) ≈ $50–200; subtitles ≈ near-zero via TTS timestamps. Managed-everything would run **several× higher** — routing + caching + self-hosting is the difference between a viable and an unviable unit economic.

---

## Sources

- **LLM:** Anthropic internal catalog (authoritative) + platform.claude.com/docs/pricing · OpenAI pricing/prompt-caching/streaming docs (developers.openai.com) · Gemini pricing + context-caching (ai.google.dev, cloudzero, finout) · Groq pricing (cloudzero, spheron) · OpenRouter pricing (truefoundry, ofox.ai) · Ollama self-host (daily.dev, localllm.in, digitalapplied)
- **Image:** BFL docs/pricing (docs.bfl.ml, bfl.ai/blog/flux-2) · Ideogram (ideogram.ai/api-pricing) · GPT Image (pricepertoken.com) · Gemini/Imagen/Nano-Banana (ai.google.dev, apidog.com) · Seedream (fal.ai, promptslove) · ComfyUI/GPU (runpod.io/pricing, digitalapplied) · **fal MCP live pricing (2026-07-30)**
- **Video:** Gemini/Vertex Veo docs · Runway Developer API (docs.dev.runwayml.com) · fal.ai model+pricing pages · Replicate · ByteDance Seedance report (seed.bytedance.com) · MiniMax (platform.minimax.io) · kling.ai/document-api · WaveSpeedAI/Higgsfield SDKs · **fal MCP live pricing (2026-07-30)**
- **Voice/Subtitles:** elevenlabs.io/pricing + with-timestamps docs · OpenAI/Google/Azure/Cartesia TTS (texttolab.com) · Suno/Udio (apimart.ai, musicmake.ai) · AssemblyAI/Deepgram/OpenAI transcription (assemblyai.com, developers.deepgram.com, costgoat.com)
