/**
 * Pipelines control + monitor. Reads live BullMQ queue state for the visual
 * monitor, kicks off Pipeline 1 (Auto button), and force-stops everything
 * (kill switch + pause + obliterate all queues).
 */
import { desc, eq } from 'drizzle-orm';
import { brands, campaigns, db, notifications, organizations, withTenant } from '@marketforge/db';
import { getOrgLlm, orgHasLlm } from '../../lib/org-llm.js';
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
  modelsForProvider,
  providerOptionsForStep,
} from './definitions.js';

export interface StepChoice {
  provider: string;
  model?: string;
}
interface OrgSettings {
  // Legacy runs stored a bare provider string; new runs store {provider, model}.
  pipelineStepProviders?: Record<string, StepChoice | string>;
}

async function readStepProviders(orgId: string): Promise<Record<string, StepChoice>> {
  const [row] = await db
    .select({ settings: organizations.settings })
    .from(organizations)
    .where(eq(organizations.id, orgId))
    .limit(1);
  const raw = (row?.settings as OrgSettings | null)?.pipelineStepProviders ?? {};
  const out: Record<string, StepChoice> = {};
  for (const [k, v] of Object.entries(raw)) {
    out[k] = typeof v === 'string' ? { provider: v } : v;
  }
  return out;
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
    // Real brands for this org (the pipeline used to show hardcoded companies).
    const brandRows = await withTenant(db, orgId, (tx) =>
      tx.select({ name: brands.companyName }).from(brands),
    );
    const companies = brandRows.map((b) => b.name);

    const pipelines = PIPELINES.map((p) => ({
      id: p.id,
      name: p.name,
      trigger: p.trigger ?? null,
      branches: p.branches ?? [],
      steps: p.steps.map((s) => {
        const options = providerOptionsForStep(s).map((id) => ({
          id,
          name: getProvider(id)?.name ?? id,
          models: modelsForProvider(id),
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
          selected_provider: selected[s.id]?.provider ?? null,
          selected_model: selected[s.id]?.model ?? null,
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
      companies,
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

    // Map brand NAMES to real brand records so the research job carries a valid
    // brand_id (and the run actually uses that brand's context).
    const brandRows = await withTenant(db, orgId, (tx) =>
      tx.select({ id: brands.id, name: brands.companyName }).from(brands),
    );
    const idByName = new Map(brandRows.map((b) => [b.name.toLowerCase(), b.id]));
    const today = new Date().toISOString().slice(0, 10);

    const runCampaigns = await Promise.all(
      plans.map(async (plan) => {
        const brandId = idByName.get(plan.brand.toLowerCase());
        // A pipeline run == a campaign, so it shows up in the Campaigns section.
        let campaignId: string | undefined;
        if (brandId) {
          const [camp] = await withTenant(db, orgId, (tx) =>
            tx
              .insert(campaigns)
              .values({
                orgId,
                brandId,
                name: `${plan.brand} · ${platform} · ${today}`,
                campaignType: 'pipeline',
                platform,
                topic: `~${plan.target_seconds}s (${plan.rounds}×${plan.clip_seconds}s) → ${plan.folder_template}`,
                status: 'queued',
                autoMode: true,
              })
              .returning({ id: campaigns.id }),
          );
          campaignId = camp?.id;
        }
        // Pipeline 1 / AI 1: the orchestrator checks the brand's CSV and
        // branches to Pipeline 2 (new contacts) or Pipeline 3 (research).
        if (brandId) {
          await enqueue('orchestrate', {
            org_id: orgId,
            brand_id: brandId,
            ...(campaignId ? { campaign_id: campaignId } : {}),
            platform,
            attempt_reason: 'manual',
            depth: 0,
          });
        } else {
          // No real brand record → seed via research directly.
          await enqueue('research', {
            org_id: orgId,
            platform,
            attempt_reason: 'manual',
            topic: `${plan.brand} · ${platform} content run`,
          });
        }
        return { brand: plan.brand, campaign_id: campaignId ?? null };
      }),
    );
    const matched = runCampaigns.filter((c) => c.campaign_id).length;
    return {
      started: true,
      runs: plans.length,
      matched_brands: matched,
      platform,
      plans,
      campaigns: runCampaigns,
    };
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

  /**
   * "Brain" supervisor: reads recent pipeline failures and, if an AI provider is
   * configured, produces a diagnosis + recommended actions. This is the
   * oversight layer — it explains what's breaking and how to fix it.
   */
  async supervisor(orgId: string) {
    const failures = await withTenant(db, orgId, (tx) =>
      tx
        .select({
          title: notifications.title,
          body: notifications.body,
          createdAt: notifications.createdAt,
        })
        .from(notifications)
        .where(eq(notifications.type, 'failure'))
        .orderBy(desc(notifications.createdAt))
        .limit(20),
    );

    const recent = failures.map((f) => ({
      title: f.title ?? '',
      body: f.body ?? '',
      at: f.createdAt.toISOString(),
    }));

    let diagnosis: string | null = null;
    let can_diagnose = false;
    if (recent.length > 0 && (await orgHasLlm(orgId))) {
      can_diagnose = true;
      try {
        const llm = await getOrgLlm(orgId);
        const res = await llm.generateText({
          task: 'reasoning',
          system:
            'You are the supervisor AI for a marketing automation pipeline. Given recent failures, give a short diagnosis of the likely root cause(s) and a numbered list of concrete fixes. Be terse and actionable.',
          prompt: `Recent pipeline failures (newest first):\n${recent
            .map((f, i) => `${i + 1}. ${f.title} — ${f.body}`)
            .join('\n')}`,
        });
        diagnosis = res.text.trim();
      } catch (err) {
        diagnosis = `Diagnosis unavailable: ${err instanceof Error ? err.message : 'AI error'}`;
      }
    }

    return {
      healthy: recent.length === 0,
      failure_count: recent.length,
      recent_failures: recent.slice(0, 8),
      can_diagnose,
      diagnosis,
    };
  },

  /** Re-enable processing after a shutdown (clear kill switch + resume). */
  async resume() {
    await clearKillSwitch();
    await Promise.allSettled(JOB_NAMES.map((n) => getQueue(n).resume()));
    return { resumed: true };
  },

  /** Assign which provider + model powers a given step (stored in org settings). */
  async setStepProvider(orgId: string, stepId: string, provider: string, model?: string) {
    const options = STEP_PROVIDER_OPTIONS[stepId];
    if (!options) throw new NotFoundError(`Unknown pipeline step: ${stepId}`);
    if (!options.includes(provider)) {
      throw new BadRequestError(
        `Provider "${provider}" is not valid for step "${stepId}"`,
      );
    }
    const validModels = modelsForProvider(provider);
    if (model && validModels.length && !validModels.includes(model)) {
      throw new BadRequestError(`Model "${model}" is not valid for provider "${provider}"`);
    }
    const [row] = await db
      .select({ settings: organizations.settings })
      .from(organizations)
      .where(eq(organizations.id, orgId))
      .limit(1);
    const existing = (row?.settings as OrgSettings | null) ?? {};
    const choice: StepChoice = { provider, ...(model ? { model } : {}) };
    const settings: OrgSettings = {
      ...existing,
      pipelineStepProviders: {
        ...(existing.pipelineStepProviders ?? {}),
        [stepId]: choice,
      },
    };
    await db
      .update(organizations)
      .set({ settings, updatedAt: new Date() })
      .where(eq(organizations.id, orgId));
    return { step_id: stepId, provider, model: model ?? null };
  },
};
