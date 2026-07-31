#!/usr/bin/env bash
# =============================================================================
# MarketForge — VPS backend deploy (Docker Compose on the shared Hostinger VPS).
# Runs from a workstation; SSHes to the VPS, syncs the repo, builds images,
# runs migrations, (re)starts api+worker+infra, and health-checks.
#
# The frontend is deployed separately to Vercel (see scripts/deploy-web.md).
#
# Prereqs on the VPS: docker + docker compose. Prereqs locally: ssh key.
# Idempotent: safe to re-run. Secrets live ONLY in the VPS /opt/marketforge/.env
# (never committed). This script never prints secret values.
#
# Usage:
#   scripts/deploy.sh              # full deploy (pull, build, migrate, up, health)
#   scripts/deploy.sh --no-build   # skip image build (config/env-only change)
#   scripts/deploy.sh --infra-only # bring up postgres/redis/n8n + migrate only
# =============================================================================
set -euo pipefail

# --- Connection (shared VPS global standard) --------------------------------
VPS_HOST="${VPS_HOST:-187.124.74.175}"
VPS_USER="${VPS_USER:-root}"
SSH_KEY="${SSH_KEY:-$HOME/.ssh/id_ed25519_deploy}"
REMOTE_DIR="${REMOTE_DIR:-/opt/marketforge}"
REPO_URL="${REPO_URL:-https://github.com/sdasgarali/MarketForge.git}"
BRANCH="${BRANCH:-main}"
COMPOSE="docker compose -f docker-compose.yml -f docker-compose.prod.yml"

BUILD=1
INFRA_ONLY=0
for arg in "$@"; do
  case "$arg" in
    --no-build) BUILD=0 ;;
    --infra-only) INFRA_ONLY=1 ;;
    *) echo "unknown arg: $arg" >&2; exit 2 ;;
  esac
done

ssh_vps() { ssh -i "$SSH_KEY" -o BatchMode=yes "${VPS_USER}@${VPS_HOST}" "$@"; }

echo "==> [1/6] Verify VPS connectivity"
ssh_vps 'hostname'

echo "==> [2/6] Sync repo on VPS ($REMOTE_DIR @ $BRANCH)"
ssh_vps "bash -s" <<EOF
set -euo pipefail
if [ -d "$REMOTE_DIR/.git" ]; then
  cd "$REMOTE_DIR" && git fetch origin "$BRANCH" && git reset --hard "origin/$BRANCH"
else
  git clone -b "$BRANCH" "$REPO_URL" "$REMOTE_DIR"
fi
EOF

echo "==> [3/6] Preflight: require .env on VPS"
ssh_vps "test -f $REMOTE_DIR/.env || { echo 'MISSING $REMOTE_DIR/.env — create it before deploy (see docs/DEPLOYMENT_PLAN.md)'; exit 1; }"

if [ "$BUILD" -eq 1 ]; then
  echo "==> [4/6] Build images"
  ssh_vps "cd $REMOTE_DIR && $COMPOSE --profile full build api worker"
else
  echo "==> [4/6] Skipping build (--no-build)"
fi

echo "==> [5/6] Migrate + bring up services"
if [ "$INFRA_ONLY" -eq 1 ]; then
  ssh_vps "cd $REMOTE_DIR && $COMPOSE up -d postgres redis n8n && $COMPOSE --profile full run --rm migrate"
else
  ssh_vps "cd $REMOTE_DIR && $COMPOSE up -d postgres redis n8n && $COMPOSE --profile full run --rm migrate && $COMPOSE --profile full up -d api worker"
fi

echo "==> [6/6] Health check"
ssh_vps "curl -fsS http://127.0.0.1:\${API_PORT:-8080}/health && echo '  <- API healthy' || { echo 'API health check FAILED'; docker logs mf-api --tail 40; exit 1; }"

echo "==> Deploy complete. Public API via nginx: https://marketforge-api.neuraforz.com/health"
