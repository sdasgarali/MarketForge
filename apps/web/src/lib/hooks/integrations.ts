'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '../api-client';

/** One configurable field of a provider integration (mirrors the API). */
export interface IntegrationField {
  key: string;
  label: string;
  secret: boolean;
  optional: boolean;
  multiline: boolean;
  placeholder: string | null;
  /** Non-secret current value (secrets are never returned). */
  value: string;
  /** Whether a value is stored (used to show "set" for secrets). */
  is_set: boolean;
}

export interface Integration {
  id: string;
  name: string;
  category:
    | 'ai_text'
    | 'ai_image'
    | 'ai_video'
    | 'ai_voice'
    | 'publishing'
    | 'storage';
  description: string;
  configured: boolean;
  updated_at: string | null;
  fields: IntegrationField[];
}

const KEY = ['integrations'];

export function useIntegrations() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<{ items: Integration[] }>('/integrations'),
    staleTime: 30_000,
  });
}

export function useSetIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { provider: string; values: Record<string, string> }) =>
      apiFetch<Integration>(`/integrations/${input.provider}`, {
        method: 'PUT',
        body: { values: input.values },
      }),
    onSuccess: (data) => {
      toast.success(`${data.name} saved`);
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to save');
    },
  });
}

export interface TestResult {
  ok: boolean;
  provider: string;
  error?: string;
  detail?: {
    auth?: boolean;
    service_account?: string;
    root_folder_ok?: boolean;
    root_folder?: string;
    hint?: string;
  };
}

export function useTestIntegration() {
  return useMutation({
    mutationFn: (provider: string) =>
      apiFetch<TestResult>(`/integrations/${provider}/test`, { method: 'POST' }),
    onSuccess: (r) => {
      const msg = r.detail?.hint ?? r.error ?? (r.ok ? 'Connected' : 'Not connected');
      if (r.ok && r.detail?.root_folder_ok !== false) toast.success(`✓ ${msg}`);
      else toast.warning(msg);
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : 'Test failed'),
  });
}

export function useRemoveIntegration() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (provider: string) =>
      apiFetch<{ id: string }>(`/integrations/${provider}`, { method: 'DELETE' }),
    onSuccess: () => {
      toast.success('Integration removed');
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (err: unknown) => {
      toast.error(err instanceof Error ? err.message : 'Failed to remove');
    },
  });
}
