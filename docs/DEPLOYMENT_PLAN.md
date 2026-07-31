# MarketForge — Deployment Plan (Web → Vercel · Backend → shared VPS)

> Written 2026-07-31. Execute only after approval. Frontend on Vercel, backend
> (api + worker + postgres + redis + n8n) on the shared Hostinger VPS
> (187.124.74.175) via Docker Compose, exposed to the Vercel frontend over an
> HTTPS subdomain (nginx reverse-proxy + certbot).

## Architecture
```
[ Vercel: apps/web (Next.js) ]  --HTTPS-->  [ marketforge-api.<domain> ]
                                                 |  (nginx 443 -> 127.0.0.1:8080)
                                                 v
        VPS Docker stack:  mf-api(8080) + mf-worker + mf-postgres(5433)
                           + mf-redis(6380) + mf-n8n(5679)
```

## VPS survey (2026-07-31, read-only)
- Free ports chosen: **API 8080**, **mf-postgres 5433**, **mf-redis 6380**, **mf-n8n 5679**, worker health 9090.
- Docker + compose v5.1 present; no `marketforge` dir yet; ~9GB RAM / 62GB disk free.
- Node 20 + no pnpm on host → **build inside Docker** (containers carry their own runtime).

## Decisions required before execution
1. **API subdomain + DNS** — pick a subdomain (proposed `marketforge-api.neuraforz.com`) and create a
   DNS **A record → 187.124.74.175**. Required for HTTPS; frontend is non-functional without it.
2. **Auth mode (pilot)** — `DEV_AUTH_BYPASS` (fast, pilot-only, NOT secure — no real login) vs wire
   **Clerk prod keys**. MVP recommendation: bypass for pilot, flagged; upgrade to Clerk before real users.

## Steps
### A. Backend on VPS
1. `git clone https://github.com/sdasgarali/MarketForge.git /opt/marketforge` (or pull if exists).
2. Create `scripts/deploy.sh` (self-contained: sync/pull → env check → compose build → migrate → up → health).
3. Add a `docker-compose.prod.yml` override: dedicated host ports (5433/6380/5679/8080), `APP_ENV`,
   no `web` service (web is on Vercel), restart policies.
4. `scp` a production `.env` to `/opt/marketforge/.env` (DB/Redis URLs, APP_ENV, auth, CORS allow Vercel
   origin). Real AI/publisher keys optional (adapters inert without them; read endpoints still work).
5. `docker compose ... up -d postgres redis n8n` → `docker compose run --rm migrate` → `... up -d api worker`.
6. Health check: `curl localhost:8080/health` on the box.

### B. Nginx + TLS (public API)
7. Add `/etc/nginx/sites-available/marketforge-api` → `proxy_pass http://127.0.0.1:8080`; enable + `nginx -t` + reload.
8. `certbot --nginx -d marketforge-api.<domain>` for SSL.
9. Verify `https://marketforge-api.<domain>/health` → 200 from outside.

### C. Frontend on Vercel
10. `vercel link` the repo (root), set **Root Directory = apps/web**, framework = Next.js, monorepo build via Turbo.
11. Env vars: `NEXT_PUBLIC_API_BASE_URL=https://marketforge-api.<domain>`, auth flags (bypass or Clerk pub key).
12. `vercel --prod`; open the URL; confirm dashboard loads and calls the live API (CORS ok).

### D. Post-deploy
13. Update `~/.claude/CLAUDE.md` VPS Port Allocation table (add 8080/5433/6380/5679 marketforge).
14. Update project `CLAUDE_REFERENCE/deployment.md` (new) + `Plan_WIP.md`.
15. Commit `scripts/deploy.sh` + `docker-compose.prod.yml` + this plan.

## Risks / notes
- `DEV_AUTH_BYPASS` on a public URL exposes admin with no login — pilot-only; lock down before real data.
- CORS on the API must allow the Vercel origin (add `CORS_ALLOWED_ORIGINS`).
- n8n on the VPS is a **separate** instance from agentshub's; dedicated port 5679, own encryption key.
- Cost stays lean: reuses existing VPS (no new managed-service bills). AI spend only when real keys added.
