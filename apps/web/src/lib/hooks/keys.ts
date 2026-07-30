/** Centralized React Query cache keys (org-scoped where relevant). */
export const qk = {
  me: ['me'] as const,
  health: ['health'] as const,
  dashboard: (orgId: string) => ['dashboard', orgId] as const,
  brands: (orgId: string) => ['brands', orgId] as const,
  brand: (orgId: string, id: string) => ['brand', orgId, id] as const,
  socialAccounts: (orgId: string, brandId: string) =>
    ['social-accounts', orgId, brandId] as const,
  campaigns: (orgId: string) => ['campaigns', orgId] as const,
  campaign: (orgId: string, id: string) => ['campaign', orgId, id] as const,
  contentItems: (orgId: string, filters: unknown) =>
    ['content-items', orgId, filters] as const,
  contentItem: (orgId: string, id: string) => ['content-item', orgId, id] as const,
  approvals: (orgId: string) => ['approvals', orgId] as const,
  analytics: (orgId: string, range: string) =>
    ['analytics', orgId, range] as const,
  promptTemplates: (orgId: string) => ['prompt-templates', orgId] as const,
  notifications: (orgId: string) => ['notifications', orgId] as const,
};
