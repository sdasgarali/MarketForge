# MarketForge Web Dashboard — Build Plan

## SESSION_CONTEXT_RETRIEVAL
> Building `apps/web/**` ONLY. Next.js App Router + TS strict + Tailwind + ShadCN + React Query
> + Zustand + Framer Motion + next-themes + Clerk (dev bypass). Types from @marketforge/contracts.
> API base NEXT_PUBLIC_API_BASE_URL (default http://localhost:8080). Mock fallbacks when API down.

## Design system
- Dark-first. Neutral zinc base + indigo/violet primary accent. OKLCH tokens via CSS vars.
- Inter (sans) + JetBrains Mono (mono). ShadCN new-york style, radius 0.65rem.
- Buffer/Linear-grade: dense sidebar, calm surfaces, subtle borders, motion on mount.

## Structure
- app/(dashboard)/layout.tsx -> shell (sidebar + topbar + org switcher + theme toggle)
- routes: dashboard, brands (+[id], new), campaigns (+[id]), content, approvals, analytics,
  settings, notifications
- components/ui/* (shadcn hand-written), components/shell/*, components/common/*
- lib/api-client.ts (typed fetch + x-org-id), lib/hooks/* (React Query), lib/mock/*
- store/ui-store.ts (org, sidebar, prefs), providers/*

## Tasks
- [x] Scaffold package.json, tsconfig, next.config, tailwind, postcss, globals.css
- [x] ShadCN primitives (button, card, input, ...), utils cn
- [x] Providers (query, theme, clerk-gated, toaster)
- [x] API client + types + mock data + hooks
- [x] Shell (sidebar, topbar, org switcher, theme toggle, mobile nav)
- [x] Pages + loading/error/empty states
- [x] .env.example note, Dockerfile
- [x] typecheck + build pass

## Verification
- pnpm --filter @marketforge/web typecheck
- pnpm --filter @marketforge/web build (with safe NEXT_PUBLIC defaults)
