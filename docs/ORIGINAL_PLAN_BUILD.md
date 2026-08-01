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
- [ ] **S1 — Drive structure + DB-only (foundations).**
  - Pure `driveContentPath({brandName,date,platform,kind,contentType})` → folder parts, with unit tests.
  - Wire into `drive-mirror`: `<Brand>/<Y>/<M>/<D>/<Platform>/<TypeSubfolder>/`. Type map:
    video→Video (short/reel→Shorts), gif→GIF, image→Image.
  - Write the **TXT** (topic+content) into the `<Platform>/` folder once per content item.
  - Drop the CSV fallback from `orchestrate` — AI 1 reads DB contacts only.
  - Verify: worker unit tests for path builder; typecheck green.
- [ ] **S2 — Calendar data model.**
  - `contentItems.scheduledDate` (DATE) + `slotIndex` (int) + index. API: `GET /calendar?brand&start&end`
    returning date×platform×items. Reuse existing content-items service.
- [ ] **S3 — Calendar dashboard + Auto day-fill.**
  - Make calendar the primary dashboard; date×platform cells; click → editor (manual chars/images/
    content/story prompts) + **Generate Video** button. `POST /calendar/fill` (date range × platforms)
    enqueues research→content→media per day/platform. "3 months in 7 days" = batched enqueue.
- [ ] **S4 — Agents.** Character Designer, Component Designer, Market Researcher (+ sub-agents:
    analyze-tenant, find-competitors, business-strategy), Competitor Analyzer, Social Media Manager,
    formal Brain/Manager that consumes sub-agent reports and decides platform/format/topic.
- [ ] **S6 — Video: Seedance 2.0 / Higgsfield wiring + long-form chunking** (N×10s → ffmpeg concat →
    Drive Video folder). Manual Generate-Video trigger endpoint.

## Honest constraints (unchanged)
- Live generation needs a valid AI key (NVIDIA free tier works) + a Google **Shared Drive** shared with
  the service account (SAs can't write to personal My Drive). Code is built ready; output needs those.
