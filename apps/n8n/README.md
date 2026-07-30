# MarketForge — n8n Integration Engine

> ADR-005: n8n = integration doing only. The backend (BullMQ worker) owns logic,
> RBAC, scheduling, and idempotency. n8n is invoked per-job via authenticated
> webhook and reports back a normalised result. n8n never owns timing.

These workflows run inside the n8n queue-mode setup defined in the root
`docker-compose.yml` (`mf-n8n` + `mf-n8n-worker` containers). Import them via
the n8n UI (Settings -> Workflows -> Import from File). All are `active:false`
at import time — activate deliberately after credential binding.

---

## Runtime context

- n8n main process: `http://localhost:5678` (or `${N8N_WEBHOOK_BASE_URL}`)
- Queue mode: main handles webhooks/UI; n8n-worker container executes nodes
- n8n uses its own Postgres DB (`N8N_DB=n8n`) inside the shared Postgres instance
- Shared Redis handles the BullMQ execution queue between main and worker

---

## Webhook calling convention

Every workflow is triggered by an HTTP POST. The worker signs every request with
HMAC-SHA256. Each workflow's first real node verifies the signature before
processing any payload data.

### Signing (worker side)

```typescript
import { createHmac } from 'crypto';

function signPayload(body: object, secret: string): string {
  const raw = JSON.stringify(body);
  return 'sha256=' + createHmac('sha256', secret).update(raw).digest('hex');
}

// Add to every outbound request:
headers['x-mf-signature'] = signPayload(body, process.env.N8N_WEBHOOK_SECRET);
```

### Verification (n8n Code node — same logic in every workflow)

The Code node reads `process.env.N8N_WEBHOOK_SECRET` from the n8n container
environment (injected via `docker-compose.yml` env block or `.env` file).
Uses `crypto.timingSafeEqual` to prevent timing attacks.

### Fallback (worker direct-adapter path)

When `N8N_WEBHOOK_BASE_URL` is unset or empty, the worker's `publish` and
`analytics` processors fall back to calling `StubPublisherAdapter` (or the real
Ayrshare adapter once implemented) directly, bypassing n8n entirely. This
ensures local development without a running n8n instance is unblocked.

---

## Required n8n Credentials

Create these credential entries in the n8n UI before activating workflows.
**Never hardcode secrets in node config.**

| Credential Name | Type | Used by | Value source |
|---|---|---|---|
| `Ayrshare API Key` | HTTP Header Auth | wf-publish, wf-collect-analytics | Header: `Authorization: Bearer <AYRSHARE_API_KEY>` |
| `fal.ai API Key` | HTTP Header Auth | wf-generate-image (optional) | Header: `Authorization: Key <FAL_API_KEY>` |

`N8N_WEBHOOK_SECRET` is NOT an n8n credential entry — it is an environment
variable on the n8n container (see `docker-compose.yml`). Set it in `.env`:

```
N8N_WEBHOOK_SECRET=CHANGE_ME_n8n_hmac
```

---

## Workflow contracts

### wf-publish

**Path:** `POST ${N8N_WEBHOOK_BASE_URL}/wf-publish`

**Request body:**
```jsonc
{
  "org_id": "uuid",
  "content_item_id": "uuid",
  "platforms": ["x", "instagram"],   // subset of: x instagram facebook linkedin youtube tiktok
  "post": {
    "text": "Post body text",
    "title": "optional — used by YouTube/LinkedIn",
    "hashtags": ["optional", "array"]
  },
  "media": [
    // Required for Instagram. Required video for YouTube.
    { "url": "https://cdn.example.com/image.jpg", "kind": "image" }
  ],
  "profileKey": "ayrshare-per-brand-profile-key"
}
```

**Response 200:**
```jsonc
{
  "results": [
    {
      "platform": "x",
      "externalPostId": "1234567890",
      "postUrl": "https://x.com/user/status/1234567890",
      "status": "published",
      "error": null
    },
    {
      "platform": "instagram",
      "externalPostId": "17858893269000001",
      "postUrl": "https://www.instagram.com/p/abc123/",
      "status": "published",
      "error": null
    }
  ]
}
```

**Response 422 (validation or Ayrshare error):**
```jsonc
{
  "results": [
    { "platform": "x", "externalPostId": null, "postUrl": null, "status": "failed", "error": "HMAC mismatch" }
  ],
  "error": "HMAC mismatch"
}
```

**Platform mapping (internal -> Ayrshare):**
`x -> twitter`, all others pass through unchanged.

**Media rules enforced in-workflow:**
- Instagram: `media` array must be non-empty
- YouTube: `media` must contain at least one `kind: "video"` item

---

### wf-collect-analytics

**Path:** `POST ${N8N_WEBHOOK_BASE_URL}/wf-collect-analytics`

**Request body:**
```jsonc
{
  "org_id": "uuid",
  "externalPostId": "1234567890",
  "platform": "x",
  "profileKey": "ayrshare-per-brand-profile-key"
}
```

**Response 200:**
```jsonc
{
  "platform": "x",
  "externalPostId": "1234567890",
  "views": 1500,
  "likes": 42,
  "comments": 7,
  "shares": 12,
  "impressions": 3200,
  "capturedAt": "2026-07-31T10:00:00.000Z",
  "raw": { /* full Ayrshare analytics object */ }
}
```

**Response 422:** same shape with null metric fields + `_error` string.

**Notes:** Ayrshare analytics field names vary by platform. The normalise node
maps `videoViews`/`reach`/`favorites`/`retweets` to the standard fields where
present. Always check `raw` if a metric is unexpectedly null for a platform.

---

### wf-error-handler

**Trigger:** n8n Error Trigger (attached to other workflows via `errorWorkflow`
setting — set the field to `wf-error-handler` by name or workflow ID after
import).

**No external request contract** — triggered automatically by n8n on execution
failure in any linked workflow.

**Actions:**
1. Formats a structured error payload (workflowId, executionId, orgId, errorMessage, lastNodeName)
2. If `SLACK_WEBHOOK_URL` env var is set on the n8n container, POSTs a Slack
   notification to that URL
3. Always emits a structured JSON log line to n8n's stdout (captured by Docker
   log driver)
4. Optionally POSTs to `DISCORD_WEBHOOK_URL` if set (safe-fails if unset)

**Wiring:** after importing all workflows, open each workflow's settings and set
`Error Workflow` to `wf-error-handler`.

---

### wf-generate-image (OPTIONAL / EXAMPLE)

**Path:** `POST ${N8N_WEBHOOK_BASE_URL}/wf-generate-image`

**Request body:**
```jsonc
{
  "org_id": "uuid",
  "content_item_id": "uuid",
  "prompt": "A professional product photo...",
  "negative_prompt": "blurry, watermark",
  "aspect_ratio": "1:1",
  "model_hint": "fal-ai/ideogram/v3",
  "count": 1
}
```

**Response 200:**
```jsonc
{
  "org_id": "uuid",
  "content_item_id": "uuid",
  "model": "fal-ai/ideogram/v3",
  "images": [
    { "index": 0, "url": "https://cdn.fal.ai/...", "width": 1024, "height": 1024, "storageKey": null }
  ],
  "usage": { "credits": 1.2 }
}
```

`storageKey` is always null from n8n — the worker is responsible for
downloading the fal CDN URL and uploading to S3 after receiving the response.

This workflow uses a fixed 8-second wait then one poll. For long-running models
(video), the worker's own adapter with proper polling loops is the correct path.

---

## Import steps

1. Start the stack: `docker compose up -d`
2. Open n8n at `http://localhost:5678` (or your configured host)
3. Create credentials: Settings -> Credentials -> New
   - `Ayrshare API Key`: HTTP Header Auth, Header Name=`Authorization`,
     Header Value=`Bearer <your AYRSHARE_API_KEY>`
   - `fal.ai API Key` (if using wf-generate-image): HTTP Header Auth,
     Header Name=`Authorization`, Header Value=`Key <your FAL_API_KEY>`
4. Import workflows: Settings -> Workflows -> Import from File, select each JSON
5. In each imported workflow, open Settings and set `Error Workflow` ->
   `wf-error-handler`
6. Activate `wf-error-handler` first, then activate the others
7. Test with a signed curl (see below)

### Test curl — wf-publish

```bash
SECRET=your_N8N_WEBHOOK_SECRET
BODY='{"org_id":"00000000-0000-0000-0000-000000000001","content_item_id":"00000000-0000-0000-0000-000000000002","platforms":["x"],"post":{"text":"Test post from MarketForge"},"media":[],"profileKey":"test-profile-key"}'
SIG=$(echo -n "$BODY" | openssl dgst -sha256 -hmac "$SECRET" | awk '{print "sha256="$2}')
curl -X POST http://localhost:5678/webhook/wf-publish \
  -H "Content-Type: application/json" \
  -H "x-mf-signature: $SIG" \
  -d "$BODY"
```

---

## Queue mode notes

- Webhook nodes are served by the **n8n main** container (port 5678)
- Execution (Code, HTTP Request nodes) runs on the **n8n-worker** container
- Under high load, add more worker replicas — the main container only scales for
  webhooks (stateless)
- n8n queue mode uses Redis (same `mf-redis` instance as BullMQ) on a separate
  key prefix — no collision with app queues
- Max execution data size: keep `raw` analytics payloads under ~1 MB per
  execution; Ayrshare responses are well within this

---

## Per-brand identity — why profileKey is in the payload, not n8n credentials

Per ADR-005 and ADR-003, each brand's Ayrshare Profile-Key is injected into
the webhook payload by the worker (sourced from the secrets package, envelope-
decrypted at job dispatch time). n8n holds only the global Ayrshare API key
(the `Authorization: Bearer` header) as a credential entry. This means:

- 500 brands = 1 n8n credential, not 500
- Rotating the global API key = one credential update in n8n UI
- Per-brand keys stay in Postgres (encrypted), managed by the backend
- n8n workflows are stateless across brands — safe to run in parallel

---

## File index

| File | Webhook path | Status |
|---|---|---|
| `wf-publish.json` | `/webhook/wf-publish` | MVP required |
| `wf-collect-analytics.json` | `/webhook/wf-collect-analytics` | MVP required |
| `wf-error-handler.json` | Error Trigger (no HTTP path) | MVP required |
| `wf-generate-image.json` | `/webhook/wf-generate-image` | Optional example |
