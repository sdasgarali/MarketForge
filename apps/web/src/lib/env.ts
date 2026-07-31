/**
 * Public (browser-visible) env surface. Only NEXT_PUBLIC_* is read here; all
 * have safe defaults so `next build` never fails for a missing var.
 */
export const env = {
  apiBaseUrl:
    process.env.NEXT_PUBLIC_API_BASE_URL?.replace(/\/$/, '') ??
    'http://localhost:8080',
  appName: 'MarketForge',
} as const;
