'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '../api-client';

export interface KnowledgeEntry {
  id: string;
  brand_id: string;
  title: string;
  content: string;
  source: string;
  created_at: string;
}

const key = (brandId: string) => ['brand-knowledge', brandId];

export function useBrandKnowledge(brandId: string) {
  return useQuery({
    queryKey: key(brandId),
    queryFn: () => apiFetch<{ items: KnowledgeEntry[] }>(`/brands/${brandId}/knowledge`),
    enabled: !!brandId,
  });
}

export function useAddBrandKnowledge(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { title: string; content: string }) =>
      apiFetch<KnowledgeEntry>(`/brands/${brandId}/knowledge`, { method: 'POST', body: input }),
    onSuccess: () => {
      toast.success('Knowledge added');
      void qc.invalidateQueries({ queryKey: key(brandId) });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });
}

export function useRefreshBrandKnowledge(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ refreshed: number; model?: string }>(`/brands/${brandId}/knowledge/refresh`, {
        method: 'POST',
      }),
    onSuccess: (r) => {
      toast.success(`AI added ${r.refreshed} snippet${r.refreshed === 1 ? '' : 's'}`);
      void qc.invalidateQueries({ queryKey: key(brandId) });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Refresh failed'),
  });
}

export function useRemoveBrandKnowledge(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/brands/${brandId}/knowledge/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Removed');
      void qc.invalidateQueries({ queryKey: key(brandId) });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });
}
