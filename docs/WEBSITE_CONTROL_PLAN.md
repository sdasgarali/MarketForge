# Remove n8n + make everything controllable from the website

> User directive: remove n8n; manage AI provider keys, Google Drive, publishing/social,
> and automation/schedules from the website admin panel (per-org, encrypted).
> Foundation exists: `api_credentials` (envelope-encrypted, RLS), `encryptSecret`/
> `decryptSecretString`, `social_accounts`, worker already has direct-adapter fallbacks.

## Slice 1 — Remove n8n  ✅ target: clean removal
- Worker: `publish.ts` + `analytics.ts` → call adapters directly (drop `isN8nEnabled` branches).
- Delete `apps/worker/src/lib/n8n.ts`; drop `N8N_*` from `constants.ts`.
- `docker-compose.yml`: remove `n8n` + `n8n-worker` services + `n8ndata` volume + n8n env.
- `packages/config/src/schema.ts`: drop `N8N_WEBHOOK_BASE_URL/SECRET`. `.env.example`: drop N8N_*.
- VPS: stop+remove mf-n8n / mf-n8n-worker containers. Docs: note n8n retired.

## Slice 2 — Integration settings backend (per-org, encrypted)
- New module `apps/api/src/modules/integrations/`: 
  - `GET /integrations` → list providers with {configured, label, updated_at} (NEVER return secrets).
  - `PUT /integrations/:provider` → encrypt + upsert into `api_credentials` (kind=`provider:<name>`, no brandId).
  - `DELETE /integrations/:provider`.
  - Providers: anthropic, openai, gemini, groq, openrouter, fal, elevenlabs, ayrshare, s3, google_drive.
- Service uses `encryptSecret` on write; a shared `resolveOrgCredential(orgId, provider)` (decrypt) for the worker.
- Admin-only (requireMinRole('admin')).

## Slice 3 — Settings UI (replace mock Integrations tab)
- `apps/web`: real Integrations screen — provider cards with Configured/Not-configured status, key input,
  Save/Remove. Google Drive + publishing shown as connectable. React Query hooks + api-client.

## Slice 4 — Adapters consume per-org keys
- `packages/adapters/factory.ts`: allow building adapters from a resolved key set (env fallback).
- Worker: per-job (orgId) resolve keys from DB → build/caches org adapters → pipeline uses org's own keys.

## Slice 5 — Publishing / social from UI
- Surface `social_accounts` connect/disconnect per brand in the UI (service already exists).

## Slice 6 — Automation & schedules from UI
- Brand `publishingSchedule` + pipeline trigger controls in the UI; backend enqueue endpoints.

Order: 1 → 2 → 3 → 4 → 5 → 6, each committed/deployed/verified. Secrets never leave the server in cleartext;
UI only shows masked/configured status.
