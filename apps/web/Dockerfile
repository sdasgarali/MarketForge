# =============================================================================
# MarketForge Web (apps/web) — Next.js standalone image.
# Multi-stage: pnpm workspace install → build → minimal runtime.
# Build context is the MONOREPO ROOT (docker build -f apps/web/Dockerfile .).
# NEXT_PUBLIC_* are build-time; pass via --build-arg. Safe defaults keep the
# build green even when unset.
# =============================================================================
FROM node:22-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate
WORKDIR /app

# ---- Dependencies (workspace-aware) ----
FROM base AS deps
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml* ./
COPY apps/web/package.json apps/web/package.json
COPY packages/contracts/package.json packages/contracts/package.json
RUN pnpm install --filter @marketforge/web... --frozen-lockfile || \
    pnpm install --filter @marketforge/web...

# ---- Build ----
FROM base AS build
ARG NEXT_PUBLIC_API_BASE_URL=http://localhost:8080
ARG NEXT_PUBLIC_DEV_AUTH_BYPASS=1
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL \
    NEXT_PUBLIC_DEV_AUTH_BYPASS=$NEXT_PUBLIC_DEV_AUTH_BYPASS \
    NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY \
    NEXT_TELEMETRY_DISABLED=1
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @marketforge/web build

# ---- Runtime (standalone) ----
FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/web/public ./apps/web/public
USER nextjs
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
