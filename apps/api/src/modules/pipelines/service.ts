/**
 * Pipelines control + monitor. Reads live BullMQ queue state for the visual
 * monitor, kicks off Pipeline 1 (Auto button), and force-stops everything
 * (kill switch + pause + obliterate all queues).
 */
import {
  JOB_NAMES,
  type JobName,
  clearKillSwitch,
  enqueue,
  engageKillSwitch,
  getQueue,
  killSwitchStatus,
} from '@marketforge/queue';
import { COMPANIES, PIPELINES, PIPELINE_QUEUES } from './definitions.js';

type Counts = Record<string, number> & { paused?: number };
type StepStatus = 'idle' | 'queued' | 'running' | 'error' | 'stopped';

async function queueSnapshot(): Promise<Record<string, Counts>> {
  const entries = await Promise.all(
    PIPELINE_QUEUES.map(async (name) => {
      const q = getQueue(name);
      const counts = (await q.getJobCounts(
        'active',
        'waiting',
        'delayed',
        'completed',
        'failed',
      )) as Counts;
      const paused = await q.isPaused();
      return [name, { ...counts, paused: paused ? 1 : 0 }] as const;
    }),
  );
  return Object.fromEntries(entries);
}

function deriveStatus(counts: Counts | undefined, killed: boolean): StepStatus {
  if (killed) return 'stopped';
  if (!counts) return 'idle';
  if ((counts.active ?? 0) > 0) return 'running';
  if ((counts.failed ?? 0) > 0) return 'error';
  if ((counts.waiting ?? 0) + (counts.delayed ?? 0) > 0) return 'queued';
  return 'idle';
}

export const pipelinesService = {
  async status() {
    const kill = await killSwitchStatus();
    const snap = await queueSnapshot();

    const pipelines = PIPELINES.map((p) => ({
      id: p.id,
      name: p.name,
      trigger: p.trigger ?? null,
      branches: p.branches ?? [],
      steps: p.steps.map((s) => ({
        id: s.id,
        label: s.label,
        queue: s.queue ?? null,
        decision: s.decision ?? false,
        note: s.note ?? null,
        status: s.queue
          ? deriveStatus(snap[s.queue], kill.engaged)
          : kill.engaged
            ? 'stopped'
            : 'idle',
        counts: s.queue ? (snap[s.queue] ?? null) : null,
      })),
    }));

    const totals = Object.values(snap).reduce<{
      active: number;
      waiting: number;
      failed: number;
      completed: number;
    }>(
      (a, c) => ({
        active: a.active + (c.active ?? 0),
        waiting: a.waiting + (c.waiting ?? 0) + (c.delayed ?? 0),
        failed: a.failed + (c.failed ?? 0),
        completed: a.completed + (c.completed ?? 0),
      }),
      { active: 0, waiting: 0, failed: 0, completed: 0 },
    );

    return {
      kill_switch: kill,
      companies: COMPANIES,
      queues: snap,
      pipelines,
      totals,
    };
  },

  /** Auto button — clear the kill switch, resume queues, kick Pipeline 1. */
  async start(orgId: string) {
    await clearKillSwitch();
    await Promise.allSettled(JOB_NAMES.map((n) => getQueue(n).resume()));
    await enqueue('research', {
      org_id: orgId,
      attempt_reason: 'manual',
      topic: 'orchestrator: check for new contacts',
    });
    return { started: true };
  },

  /** Force shutdown — engage kill switch + pause + obliterate EVERY queue. */
  async shutdown(meta: { by?: string }) {
    await engageKillSwitch({ reason: 'operator force shutdown', by: meta.by });
    const stopped: JobName[] = [];
    let removed = 0;
    for (const name of JOB_NAMES) {
      const q = getQueue(name);
      try {
        const c = (await q.getJobCounts('active', 'waiting', 'delayed')) as Counts;
        removed += (c.active ?? 0) + (c.waiting ?? 0) + (c.delayed ?? 0);
        await q.pause();
        await q.obliterate({ force: true });
        stopped.push(name);
      } catch {
        // best-effort: keep force-stopping the remaining queues
      }
    }
    return { shutdown: true, queues_stopped: stopped.length, jobs_removed: removed };
  },

  /** Re-enable processing after a shutdown (clear kill switch + resume). */
  async resume() {
    await clearKillSwitch();
    await Promise.allSettled(JOB_NAMES.map((n) => getQueue(n).resume()));
    return { resumed: true };
  },
};
