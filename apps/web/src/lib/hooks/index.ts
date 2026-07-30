'use client';

import {
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '../api-client';
import type {
  AnalyticsSummary,
  ApprovalItem,
  Brand,
  BrandCreateInput,
  Campaign,
  CampaignCreateInput,
  CompositeReview,
  ContentItem,
  ContentStatus,
  DashboardSummary,
  MeResponse,
  Notification,
  Paginated,
  Platform,
  PromptTemplate,
  ReviewResult,
  SocialAccount,
} from '../types';
import {
  mockAnalytics,
  mockApprovals,
  mockBrands,
  mockCampaigns,
  mockCompositeFor,
  mockContentItems,
  mockDashboard,
  mockMe,
  mockNotifications,
  mockPromptTemplates,
  mockSocialAccounts,
} from '../mock/data';
import { useOrgId } from '@/store/ui-store';
import { qk } from './keys';
import { withFallback } from './use-fallback';

const list = <T>(items: T[]): Paginated<T> => ({
  items,
  total: items.length,
  limit: 100,
  offset: 0,
});

// ============================================================================
// ME (bootstrap)
// ============================================================================
export function useMe() {
  return useQuery({
    queryKey: qk.me,
    queryFn: async () => {
      const r = await withFallback(
        () => apiFetch<MeResponse>('/me'),
        () => mockMe,
      );
      return r;
    },
    staleTime: 5 * 60_000,
  });
}

export function useHealth() {
  return useQuery({
    queryKey: qk.health,
    queryFn: () =>
      withFallback(
        () => apiFetch<{ status: string }>('/health'),
        () => ({ status: 'mock' }),
      ),
    refetchInterval: 30_000,
    staleTime: 20_000,
  });
}

// ============================================================================
// DASHBOARD
// ============================================================================
export function useDashboard() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.dashboard(orgId),
    queryFn: () =>
      withFallback(
        () => apiFetch<DashboardSummary>('/dashboard/summary'),
        () => mockDashboard,
      ),
    staleTime: 60_000,
  });
}

// ============================================================================
// BRANDS
// ============================================================================
export function useBrands() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.brands(orgId),
    queryFn: () =>
      withFallback(
        () => apiFetch<Paginated<Brand>>('/brands'),
        () => list(mockBrands),
      ),
    staleTime: 60_000,
  });
}

export function useBrand(id: string) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.brand(orgId, id),
    queryFn: () =>
      withFallback(
        () => apiFetch<Brand>(`/brands/${id}`),
        () => mockBrands.find((b) => b.id === id) ?? mockBrands[0]!,
      ),
    enabled: !!id,
  });
}

export function useSocialAccounts(brandId: string) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.socialAccounts(orgId, brandId),
    queryFn: () =>
      withFallback(
        () =>
          apiFetch<Paginated<SocialAccount>>(
            `/brands/${brandId}/social-accounts`,
          ),
        () => list(mockSocialAccounts.filter((s) => s.brand_id === brandId)),
      ),
    enabled: !!brandId,
  });
}

export function useCreateBrand() {
  const qc = useQueryClient();
  const orgId = useOrgId();
  return useMutation({
    mutationFn: (input: BrandCreateInput) =>
      apiFetch<Brand>('/brands', { method: 'POST', body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.brands(orgId) });
      toast.success('Brand created');
    },
    onError: (e: Error) => toast.error(`Could not create brand: ${e.message}`),
  });
}

export function useUpdateBrand(id: string) {
  const qc = useQueryClient();
  const orgId = useOrgId();
  return useMutation({
    mutationFn: (input: Partial<BrandCreateInput>) =>
      apiFetch<Brand>(`/brands/${id}`, { method: 'PATCH', body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.brands(orgId) });
      qc.invalidateQueries({ queryKey: qk.brand(orgId, id) });
      toast.success('Brand updated');
    },
    onError: (e: Error) => toast.error(`Could not update brand: ${e.message}`),
  });
}

// ============================================================================
// CAMPAIGNS
// ============================================================================
export function useCampaigns() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.campaigns(orgId),
    queryFn: () =>
      withFallback(
        () => apiFetch<Paginated<Campaign>>('/campaigns'),
        () => list(mockCampaigns),
      ),
    staleTime: 60_000,
  });
}

export function useCampaign(id: string) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.campaign(orgId, id),
    queryFn: () =>
      withFallback(
        () => apiFetch<Campaign>(`/campaigns/${id}`),
        () => mockCampaigns.find((c) => c.id === id) ?? mockCampaigns[0]!,
      ),
    enabled: !!id,
  });
}

export function useCreateCampaign() {
  const qc = useQueryClient();
  const orgId = useOrgId();
  return useMutation({
    mutationFn: (input: CampaignCreateInput) =>
      apiFetch<Campaign>('/campaigns', { method: 'POST', body: input }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.campaigns(orgId) });
      toast.success('Campaign created');
    },
    onError: (e: Error) =>
      toast.error(`Could not create campaign: ${e.message}`),
  });
}

export function useStartCampaign() {
  const qc = useQueryClient();
  const orgId = useOrgId();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<Campaign>(`/campaigns/${id}/start`, { method: 'POST' }),
    onSuccess: (_data, id) => {
      qc.invalidateQueries({ queryKey: qk.campaigns(orgId) });
      qc.invalidateQueries({ queryKey: qk.campaign(orgId, id) });
      toast.success('Campaign started — jobs enqueued');
    },
    onError: (e: Error) => toast.error(`Could not start campaign: ${e.message}`),
  });
}

// ============================================================================
// CONTENT ITEMS
// ============================================================================
export interface ContentFilters {
  status?: ContentStatus;
  platform?: Platform;
  brand?: string;
  campaign?: string;
}

export function useContentItems(filters: ContentFilters) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.contentItems(orgId, filters),
    queryFn: () =>
      withFallback(
        () =>
          apiFetch<Paginated<ContentItem>>('/content-items', {
            query: {
              status: filters.status,
              platform: filters.platform,
              brand: filters.brand,
              campaign: filters.campaign,
            },
          }),
        () =>
          list(
            mockContentItems.filter(
              (c) =>
                (!filters.status || c.status === filters.status) &&
                (!filters.platform || c.platform === filters.platform) &&
                (!filters.brand || c.brand_id === filters.brand) &&
                (!filters.campaign || c.campaign_id === filters.campaign),
            ),
          ),
      ),
    staleTime: 30_000,
  });
}

export function useContentItem(id: string) {
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.contentItem(orgId, id),
    queryFn: () =>
      withFallback(
        () =>
          apiFetch<{
            item: ContentItem;
            composite?: CompositeReview;
            reviews?: ReviewResult[];
          }>(`/content-items/${id}`),
        () => {
          const item =
            mockContentItems.find((c) => c.id === id) ?? mockContentItems[0]!;
          const { composite, reviews } = mockCompositeFor(item.id);
          return { item, composite, reviews };
        },
      ),
    enabled: !!id,
  });
}

export function useRegenerateContent() {
  const qc = useQueryClient();
  const orgId = useOrgId();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<ContentItem>(`/content-items/${id}/regenerate`, {
        method: 'POST',
      }),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: qk.approvals(orgId) });
      toast.success('Regeneration queued');
    },
    onError: (e: Error) => toast.error(`Could not regenerate: ${e.message}`),
  });
}

// ============================================================================
// APPROVALS (with optimistic remove)
// ============================================================================
export function useApprovals() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.approvals(orgId),
    queryFn: () =>
      withFallback(
        () => apiFetch<Paginated<ApprovalItem>>('/approvals'),
        () => list(mockApprovals),
      ),
    staleTime: 20_000,
  });
}

function useApprovalDecision(
  path: (id: string) => string,
  successMsg: string,
) {
  const qc = useQueryClient();
  const orgId = useOrgId();
  const key = qk.approvals(orgId);
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<unknown>(path(id), { method: 'POST' }),
    onMutate: async (id: string) => {
      await qc.cancelQueries({ queryKey: key });
      const prev = qc.getQueryData<{ data: Paginated<ApprovalItem> }>(key);
      qc.setQueryData<{ data: Paginated<ApprovalItem>; isMock: boolean }>(
        key,
        (old) =>
          old
            ? {
                ...old,
                data: {
                  ...old.data,
                  items: old.data.items.filter(
                    (a) => a.content_item.id !== id,
                  ),
                  total: Math.max(0, old.data.total - 1),
                },
              }
            : old,
      );
      return { prev };
    },
    onError: (e: Error, _id, ctx) => {
      if (ctx?.prev) qc.setQueryData(key, ctx.prev);
      toast.error(`Action failed: ${e.message}`);
    },
    onSuccess: () => {
      toast.success(successMsg);
      qc.invalidateQueries({ queryKey: qk.dashboard(orgId) });
    },
    onSettled: () => qc.invalidateQueries({ queryKey: key }),
  });
}

export function useApprove() {
  return useApprovalDecision(
    (id) => `/content-items/${id}/approve`,
    'Approved — scheduled for publishing',
  );
}

export function useReject() {
  return useApprovalDecision(
    (id) => `/content-items/${id}/reject`,
    'Rejected',
  );
}

// ============================================================================
// ANALYTICS
// ============================================================================
export function useAnalytics(range = '30d') {
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.analytics(orgId, range),
    queryFn: () =>
      withFallback(
        () =>
          apiFetch<AnalyticsSummary>('/analytics', { query: { range } }),
        () => mockAnalytics,
      ),
    staleTime: 5 * 60_000,
  });
}

// ============================================================================
// PROMPT TEMPLATES
// ============================================================================
export function usePromptTemplates() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.promptTemplates(orgId),
    queryFn: () =>
      withFallback(
        () => apiFetch<Paginated<PromptTemplate>>('/prompt-templates'),
        () => list(mockPromptTemplates),
      ),
    staleTime: 5 * 60_000,
  });
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================
export function useNotifications() {
  const orgId = useOrgId();
  return useQuery({
    queryKey: qk.notifications(orgId),
    queryFn: () =>
      withFallback(
        () => apiFetch<Paginated<Notification>>('/notifications'),
        () => list(mockNotifications),
      ),
    staleTime: 30_000,
  });
}
