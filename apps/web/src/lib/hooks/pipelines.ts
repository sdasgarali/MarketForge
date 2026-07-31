'use client';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { apiFetch } from '../api-client';

export type StepStatus = 'idle' | 'queued' | 'running' | 'error' | 'stopped';

export interface StepView {
  id: string;
  label: string;
  queue: string | null;
  decision: boolean;
  note: string | null;
  status: StepStatus;
  counts: Record<string, number> | null;
}

export interface PipelineView {
  id: string;
  name: string;
  trigger: string | null;
  branches: string[];
  steps: StepView[];
}

export interface PipelinesStatus {
  kill_switch: { engaged: boolean; at?: string; reason?: string; by?: string };
  companies: string[];
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

export function useStartPipelines() {
  return usePipelineAction('start', () => 'Pipelines started');
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
