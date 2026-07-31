'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '../api-client';

export type StepStatus = 'idle' | 'queued' | 'running' | 'error' | 'stopped';

export interface ProviderOption {
  id: string;
  name: string;
  models: string[];
}

export interface StepView {
  id: string;
  label: string;
  queue: string | null;
  decision: boolean;
  note: string | null;
  status: StepStatus;
  counts: Record<string, number> | null;
  provider_options: ProviderOption[];
  selected_provider: string | null;
  selected_model: string | null;
}

export interface PipelineView {
  id: string;
  name: string;
  trigger: string | null;
  branches: string[];
  steps: StepView[];
}

export interface PlatformOption {
  id: string;
  label: string;
  targetSeconds: number;
}

export interface PipelinesStatus {
  kill_switch: { engaged: boolean; at?: string; reason?: string; by?: string };
  companies: string[];
  platforms: PlatformOption[];
  totals: { active: number; waiting: number; failed: number; completed: number };
  pipelines: PipelineView[];
}

const KEY = ['pipelines'];

export function usePipelines() {
  return useQuery({
    queryKey: KEY,
    queryFn: () => apiFetch<PipelinesStatus>('/pipelines'),
    // Live monitor — poll every 3s.
    refetchInterval: 3000,
    refetchOnWindowFocus: true,
  });
}

function usePipelineAction(
  path: string,
  successMsg: (r: unknown) => string,
) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () => apiFetch<Record<string, unknown>>(`/pipelines/${path}`, { method: 'POST' }),
    onSuccess: (r) => {
      toast.success(successMsg(r));
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : 'Action failed'),
  });
}

export interface RunPlan {
  brand: string;
  platform: string;
  target_seconds: number;
  clip_seconds: number;
  rounds: number;
  folder_template: string;
}

export function useStartPipelines() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { brands?: string[]; platform?: string }) =>
      apiFetch<{ started: boolean; runs: number; platform: string; plans: RunPlan[] }>(
        '/pipelines/start',
        { method: 'POST', body: input },
      ),
    onSuccess: (r) => {
      toast.success(
        `Started ${r.runs} run${r.runs === 1 ? '' : 's'} on ${r.platform}`,
      );
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : 'Failed to start'),
  });
}

export function useShutdownPipelines() {
  return usePipelineAction(
    'shutdown',
    (r) =>
      `Force shutdown — ${(r as { jobs_removed?: number }).jobs_removed ?? 0} jobs killed`,
  );
}

export function useResumePipelines() {
  return usePipelineAction('resume', () => 'Pipelines re-enabled');
}

export interface SupervisorStatus {
  healthy: boolean;
  failure_count: number;
  recent_failures: Array<{ title: string; body: string; at: string }>;
  can_diagnose: boolean;
  diagnosis: string | null;
}

export function useSupervisor() {
  return useQuery({
    queryKey: ['pipelines', 'supervisor'],
    queryFn: () => apiFetch<SupervisorStatus>('/pipelines/supervisor'),
    refetchInterval: 15000,
  });
}

export function useSeedDefaultBrands() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: () =>
      apiFetch<{ seeded: number }>('/brands/seed-defaults', { method: 'POST' }),
    onSuccess: (r) => {
      toast.success(`Created ${r.seeded} brand${r.seeded === 1 ? '' : 's'}`);
      void qc.invalidateQueries({ queryKey: KEY });
      void qc.invalidateQueries({ queryKey: ['brands'] });
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : 'Failed to create brands'),
  });
}

export function useSetStepProvider() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: { stepId: string; provider: string; model?: string }) =>
      apiFetch<{ step_id: string; provider: string; model: string | null }>(
        `/pipelines/steps/${input.stepId}/provider`,
        {
          method: 'PUT',
          body: { provider: input.provider, ...(input.model ? { model: input.model } : {}) },
        },
      ),
    onSuccess: () => {
      toast.success('Step provider updated');
      void qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (err: unknown) =>
      toast.error(err instanceof Error ? err.message : 'Failed to set provider'),
  });
}
