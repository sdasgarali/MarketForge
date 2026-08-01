# Original Plan → Build Plan (make it real)

> Source: `original plan.txt`. Operator directive (2026-08-01): "make it real, make changes
> whatever you want, **don't use CSV — use the database** for that, **but store content in gDrive**."
> This doc maps every numbered section of the original plan to concrete build slices. Execute in
> small verifiable slices; commit each. Update checkboxes as we go.

## Guiding deltas from the operator
- **No CSV anywhere.** All operational data (contacts/leads, calendar, topics, state) lives in Postgres.
  Drop the CSV-in-Drive fallback from AI 1 (orchestrator). Drive is for **generated content only**.
- **Content stored in Google Drive** in this structure (per plan's File Structure section):
  ```
  <Brand>/<Year>/<Month>/<Day>/<Platform>/
     ├── <topic>.txt              (Topic + Content)
     ├── Video/                   (long videos)
     ├── Shorts/                  (≤15s shorts)
     ├── Image/                   (blog/case-study/poster/news images)
     └── GIF/                     (gif loops)
  ```
- Calendar is the centerpiece: **Dashboard = calendar**, each date × platform holds editable content.

## Plan section → status → slice
| # | Original plan item | Current state | Slice |
|---|---|---|---|
| 1 | Multi-tenant website | ✅ RLS + per-signup org | — |
| 2 | Select tenant → home | ✅ (single active org per user) | — |
| 3 | Dashboard = **calendar**; date×platform; manual input chars/images/content/story prompts | ❌ calendar is a read-only tab; no editor | S2, S3 |
| 4 | Manual **Generate Video** → Seedance 2.0 (Higgsfield) | ❌ no manual trigger; Higgsfield/Seedance not wired | S3, S6 |
| 5 | Agents: Brain, Content Writer, Character Designer, Market Researcher, Competitor Analyzer, SMM | ⚠ Writer✅ Reviewer✅ Brain(implicit); 4 missing | S4 |
| 6 | **Auto** → fill a complete day across platforms; 3 months in 7 days; 5TB Drive | ❌ Auto = 1 campaign/brand, not day-fill | S3 |
| 7 | Auto workflow: Market Research Manager + sub-agents (tenant/competitor/strategy) → decides | ⚠ basic research only | S4 |
| 8 | Writer + Reviewer loop; Poster Artist; Video→Char/Component→Seedance; long→chunk 10s clips | ⚠ loop✅ poster✅ short✅; char/component/chunk missing | S4, S6 |
| — | **Drive File Structure** (Year/Month/Day→Platform→{TXT,Video,Shorts,Image,GIF}) | ❌ `Brand/{videos,images}/topic` | **S1** |
| — | **No CSV** (DB only) | ⚠ CSV fallback still in orchestrator | **S1** |

## Slices (ordered)
- [x] **S1 — Drive structure + DB-only (foundations).** ✅ (commit 8fe83ae)
  - Pure `driveContentPath()` in `apps/worker/src/lib/drive-path.ts` + 8 unit tests.
  - `drive-mirror` now uploads `<Brand>/<Y>/<Month>/<D>/<Platform>/<TypeSubfolder>/` + writes a
    `<topic>.txt` (topic+content) into the Platform folder (idempotent).
  - CSV fallback removed from `orchestrate` — AI 1 reads DB contacts only.
- [x] **S2 — Calendar data model.** ✅ (commit 7199f2e)
  - `contentItems.scheduledDate` (DATE) + `slotIndex` (int) + index. DDL: `scripts/ddl/2026-08-01-...sql`.
  - `GET /content-items/calendar?brand_id&platform&start&end`; `POST /` + `PATCH /:id` manual authoring
    (characters/story_prompt/image_prompt in metadata). DTO carries scheduled_date/slot_index.
- [x] **S3 — Calendar authoring + Generate Video + Auto day-fill.** ✅ (commits aafb080, bb09d0b)
  - Editable calendar: per-day "+" and item-click open `ContentEditorDialog` (topic/content/caption/
    hashtags/characters/story+image prompts); plots by scheduled_date. Manual **Generate Video** button →
    `POST /content-items/:id/generate-video`.
  - **Auto day-fill**: `POST /content-items/fill` (date range × brands × platforms × per-day) creates
    dated drafts + queues generation in place (cap 500). `CalendarFillDialog` on the Content page.
  - NOTE: "Dashboard = calendar" — the calendar lives on `/content` (primary tab). Making it the literal
    `/dashboard` landing is a small follow-up (route swap) if desired.
- [x] **S4 — Agents.** ✅ (commit 9e4da5d)
  - **Market Research Manager** (`market-research.agent.ts`) runs 3 sub-agents in parallel —
    tenant analysis, competitor analysis, business strategy — then a Manager synthesis that DECIDES
    topics + recommended platforms + format per platform. Wired into the `research` processor: the
    fan-out now targets the Manager's recommended platforms with the recommended `content_type`.
    (Competitor Analyzer = the competitor sub-agent; Social Media Manager = the Manager's platform/
    format decision.) Old single-shot `research.agent.ts` removed (superseded).
  - **Character Designer + Component Designer** (`video-design.agent.ts`, pure `composeVideoPrompt` +
    3 tests) wired into `generate-video`: expand the brief into on-brand character + scene descriptions
    folded into the video prompt (best-effort). Brain = `orchestrate` (implicit) + supervisor panel.
- [x] **S6 — Long-form video chunking (GUARDED).** ✅ (operator chose "build it, keep it OFF")
  - media-policy: new `longform` action (rounds × clipS, total capped at `VIDEO_LONGFORM_MAX_S`), +4 tests.
  - `generate-video`: generates N clips → `concatMp4()` (ffmpeg concat demuxer, temp-file, cross-platform)
    → one mp4 → store + **Drive mirror**. Degrades to per-clip storage + notify if ffmpeg is absent.
  - **Videos now mirror to Drive** (short/gif/long-form all enqueue drive-mirror → land in the
    Video/Shorts/GIF folders from S1). Config: `VIDEO_CLIP_MAX_S` (10), `VIDEO_LONGFORM_MAX_S` (300).
  - **Still OFF by default** (`VIDEO_ALLOW_LONGFORM=false`) → zero spend until flipped. CLAUDE.md updated.
  - NOTE: still uses the fal video adapter (Kling) per clip; a dedicated **Seedance 2.0 / Higgsfield**
    adapter is a separate future task (the manual Generate-Video trigger + model_hint plumbing is ready).

## Honest constraints (unchanged)
- Live generation needs a valid AI key (NVIDIA free tier works) + a Google **Shared Drive** shared with
  the service account (SAs can't write to personal My Drive). Code is built ready; output needs those.
