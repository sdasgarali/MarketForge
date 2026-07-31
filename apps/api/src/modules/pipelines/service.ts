/**
 * Pipelines control + monitor. Reads live BullMQ queue state for the visual
 * monitor, kicks off Pipeline 1 (Auto button), and force-stops everything
 * (kill switch + pause + obliterate all queues).
 */
import { eq } from 'drizzle-orm';
import { db, organizations } from '@marketforge/db';
import {
  JOB_NAMES,
  type JobName,
  clearKillSwitch,
  enqueue,
  engageKillSwitch,
  getQueue,
  killSwitchStatus,
} from '@marketforge/queue';
import { BadRequestError, NotFoundError } from '../../http/errors.js';
import { getProvider } from '../integrations/registry.js';
import {
  COMPANIES,
  PIPELINES,
  PIPELINE_QUEUES,
  PLATFORMS,
  type PlatformId,
  STEP_PROVIDER_OPTIONS,
  buildRunPlan,
  providerOptionsForStep,
} from './definitions.js';

interface OrgSettings {
  pipelineStepProviders?: Record<string, string>;
}

async function readStepProviders(orgId: string): Promise<Record<string, string>> {
  const [row] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  return (row?.settings as OrgSettings | null)?.pipelineStepProviders ?? {};
}

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
  async status(orgId: string) {
    const kill = await killSwitchStatus();
    const snap = await queueSnapshot();
    const selected = await readStepProviders(orgId);

    const pipelines = PIPELINES.map((p) => ({
      id: p.id,
      name: p.name,
      trigger: p.trigger ?? null,
      branches: p.branches ?? [],
      steps: p.steps.map((s) => {
        const options = providerOptionsForStep(s).map((id) => ({
          id,
          name: getProvider(id)?.name ?? id,
        }));
        return {
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
          provider_options: options,
          selected_provider: selected[s.id] ?? null,
        };
      }),
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
      platforms: PLATFORMS,
      queues: snap,
      pipelines,
      totals,
    };
  },

  /**
   * Start a run for one/all brands on a platform. Enqueues a research job per
   * brand — brands run in PARALLEL. Each run carries a plan (target duration →
   * number of 10s rounds, and the <Brand>/videos/<topic> folder template).
   */
  async start(
    orgId: string,
    opts: { brands?: string[]; platform?: string } = {},
  ) {
    await clearKillSwitch();
    await Promise.allSettled(JOB_NAMES.map((n) => getQueue(n).resume()));

    const platform: PlatformId =
      PLATFORMS.find((p) => p.id === opts.platform)?.id ?? 'instagram';
    const targets =
      opts.brands && opts.brands.length ? opts.brands : [...COMPANIES];
    const plans = targets.map((b) => buildRunPlan(b, platform));

    await Promise.all(
      plans.map((plan) =>
        enqueue('research', {
          org_id: orgId,
          platform,
          attempt_reason: 'manual',
          topic: `${plan.brand} · ${platform} · ~${plan.target_seconds}s (${plan.rounds}×${plan.clip_seconds}s) → ${plan.folder_template}`,
        }),
      ),
    );
    return { started: true, runs: plans.length, platform, plans };
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

  /** Assign which provider powers a given step (stored in org settings). */
  async setStepProvider(orgId: string, stepId: string, provider: string) {
    const options = STEP_PROVIDER_OPTIONS[stepId];
    if (!options) throw new NotFoundError(`Unknown pipeline step: ${stepId}`);
    if (!options.includes(provider)) {
      throw new BadRequestError(
        `Provider "${provider}" is not valid for step "${stepId}"`,
      );
    }
    const [row] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    const existing = (row?.settings as OrgSettings | null) ?? {};
    const settings: OrgSettings = {
      ...existing,
      pipelineStepProviders: {
        ...(existing.pipelineStepProviders ?? {}),
        [stepId]: provider,
      },
    };
    await db
      .update(organizations)
      .set({ settings, updatedAt: new Date() })
      .where(eq(organizations.id, orgId));
    return { step_id: stepId, provider };
  },
};
