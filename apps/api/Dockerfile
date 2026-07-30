# syntax=docker/dockerfile:1
# MarketForge API service. Built from the monorepo root context so workspace
# packages (@marketforge/*) resolve. Multi-stage: install+build, then a lean
# runtime image running the compiled dist output.
FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /repo

# ---- Dependencies + build -------------------------------------------------
FROM base AS build
# Copy manifests first for better layer caching.
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml tsconfig.base.json ./
COPY packages ./packages
COPY apps/api ./apps/api
RUN pnpm install --frozen-lockfile
# Build workspace deps then the API.
RUN pnpm --filter @marketforge/api... build

# ---- Runtime --------------------------------------------------------------
FROM base AS runtime
ENV NODE_ENV=production
WORKDIR /repo
COPY --from=build /repo/pnpm-workspace.yaml /repo/package.json /repo/pnpm-lock.yaml ./
COPY --from=build /repo/packages ./packages
COPY --from=build /repo/apps/api ./apps/api
# Install production deps only (workspace packages are already built to dist).
RUN pnpm install --frozen-lockfile --prod
WORKDIR /repo/apps/api
EXPOSE 8080
CMD ["node", "dist/index.js"]
