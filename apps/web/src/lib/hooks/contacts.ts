'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '../api-client';

export interface Contact {
  id: string;
  brand_id: string;
  name: string | null;
  handle: string | null;
  company: string | null;
  source: string;
  status: string;
  created_at: string;
}

export interface ContactInput {
  name?: string;
  handle?: string;
  company?: string;
}

const key = (brandId: string) => ['brand-contacts', brandId];

export function useContacts(brandId: string) {
  return useQuery({
    queryKey: key(brandId),
    queryFn: () => apiFetch<{ items: Contact[] }>(`/brands/${brandId}/contacts`),
    enabled: !!brandId,
  });
}

export function useAddContacts(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (contacts: ContactInput[]) =>
      apiFetch<{ added: number; contacts: Contact[] }>(`/brands/${brandId}/contacts`, {
        method: 'POST',
        body: { contacts },
      }),
    onSuccess: (r) => {
      toast.success(
        `${r.added} contact${r.added === 1 ? '' : 's'} added — AI 1 will run Pipeline 2 on next run`,
      );
      void qc.invalidateQueries({ queryKey: key(brandId) });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });
}

export function useRemoveContact(brandId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) =>
      apiFetch<{ id: string }>(`/brands/${brandId}/contacts/${id}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Removed');
      void qc.invalidateQueries({ queryKey: key(brandId) });
    },
    onError: (e: unknown) => toast.error(e instanceof Error ? e.message : 'Failed'),
  });
}
