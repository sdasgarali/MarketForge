/**
 * Public (browser-visible) env surface. Only NEXT_PUBLIC_* is read here; all
 * have safe defaults so `next build` never fails for a missing var. Secrets
 * never appear in this file.
 */
export const env = {
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ??
    'http://localhost:8080',
  /** '1' => run without Clerk (fake admin/org). Any other value => Clerk on. */
  devAuthBypass: process.env.NEXT_PUBLIC_DEV_AUTH_BYPASS === '1',
  clerkPublishableKey:
    process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY ?? '',
  appName: 'MarketForge',
} as const;

/** Clerk is only truly usable when a publishable key exists AND bypass is off. */
export const clerkEnabled = !env.devAuthBypass && env.clerkPublishableKey.length > 0;
