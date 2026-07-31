# syntax=docker/dockerfile:1
# =============================================================================
# MarketForge worker — BullMQ job processors (the content pipeline).
# Multi-stage: prune the monorepo to the worker's dependency closure, install
# with pnpm, build with tsup, then run a lean production image.
# =============================================================================

# ---- Base: Node 22 + pnpm ----------------------------------------------------
FROM node:22-slim AS base
ENV PNPM_HOME="/pnpm" \
    PATH="/pnpm:$PATH" \
    CI=true
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ---- Prune: isolate the worker + its workspace deps -------------------------
FROM base AS prune
RUN pnpm add -g turbo@^2.3.3
COPY . .
# Produces /app/out/{json,full} with only @marketforge/worker and its deps.
RUN turbo prune @marketforge/worker --docker

# ---- Install + build ---------------------------------------------------------
FROM base AS build
# Install deps against the pruned lockfile (better layer caching).
COPY --from=prune /app/out/json/ ./
COPY --from=prune /app/out/pnpm-lock.yaml ./pnpm-lock.yaml
RUN pnpm install --frozen-lockfile

# Copy the pruned source + shared root config, then build.
COPY --from=prune /app/out/full/ ./
COPY tsconfig.base.json ./tsconfig.base.json
# Build the worker AND its workspace deps (the `...` suffix) so every
# @marketforge/* package has a dist/ before `pnpm deploy` copies them —
# otherwise the runtime image is missing e.g. @marketforge/queue/dist.
RUN pnpm --filter "@marketforge/worker..." build

# Drop dev dependencies for the runtime image.
RUN pnpm --filter @marketforge/worker --prod deploy /app/deploy

# ---- Runtime -----------------------------------------------------------------
FROM node:22-slim AS runtime
ENV NODE_ENV=production
WORKDIR /app
# Non-root for safety.
USER node
COPY --from=build --chown=node:node /app/deploy/node_modules ./node_modules
COPY --from=build --chown=node:node /app/apps/worker/dist ./dist
COPY --from=build --chown=node:node /app/apps/worker/package.json ./package.json

# Health/readiness probe port (see src/lib/health.ts).
EXPOSE 9090
HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.WORKER_HEALTH_PORT||9090)+'/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "dist/index.js"]
