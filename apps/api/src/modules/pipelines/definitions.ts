import type { JobName } from '@marketforge/contracts';

/**
 * The 3-pipeline automation the operator designed, expressed as a visual graph
 * for the monitor. Each step optionally maps to a BullMQ queue so the UI can
 * light it up from live queue activity. Pure logic/decision steps have no queue.
 */
export interface PipelineStep {
  id: string;
  label: string;
  /** Live status is derived from this queue's job counts (if set). */
  queue?: JobName;
  /** Decision/branch node (rendered differently). */
  decision?: boolean;
  note?: string;
}

export interface PipelineDef {
  id: string;
  name: string;
  trigger?: string;
  steps: PipelineStep[];
  /** Human-readable outgoing branches (for the orchestrator). */
  branches?: string[];
}

/** Companies (brands) whose CSVs / assets the pipelines fan out across. */
export const COMPANIES = ['Neuraforz', 'Exzelon', 'Medeoan', 'Tavakkul'] as const;

/** Social platforms a run can target. `id` matches the Platform enum. */
export const PLATFORMS = [
  { id: 'instagram', label: 'Instagram', targetSeconds: 60 },
  { id: 'x', label: 'X', targetSeconds: 45 },
  { id: 'youtube', label: 'YouTube', targetSeconds: 60 },
  { id: 'tiktok', label: 'TikTok', targetSeconds: 60 },
  { id: 'facebook', label: 'Facebook', targetSeconds: 45 },
  { id: 'linkedin', label: 'LinkedIn', targetSeconds: 45 },
] as const;

export type PlatformId = (typeof PLATFORMS)[number]['id'];

/** Per-clip length a single generation produces (Kling short-form). */
export const CLIP_SECONDS = 10;

/**
 * How many generation rounds are needed to reach the target duration when each
 * round yields a `clipSeconds` clip. e.g. 60s target / 10s clip = 6 rounds —
 * exactly the operator's "1 min needs 6 rounds of 10s" rule.
 */
export function planVideoRounds(targetSeconds: number, clipSeconds = CLIP_SECONDS): number {
  if (clipSeconds <= 0) return 1;
  return Math.max(1, Math.ceil(targetSeconds / clipSeconds));
}

export interface RunPlan {
  brand: string;
  platform: PlatformId;
  target_seconds: number;
  clip_seconds: number;
  rounds: number;
  /** Where finished content lands: <Brand>/videos/<topic>/ (topic subfolder created after research). */
  folder_template: string;
}

export function buildRunPlan(brand: string, platform: PlatformId): RunPlan {
  const def = PLATFORMS.find((p) => p.id === platform) ?? PLATFORMS[0];
  const target = def.targetSeconds;
  return {
    brand,
    platform,
    target_seconds: target,
    clip_seconds: CLIP_SECONDS,
    rounds: planVideoRounds(target),
    folder_template: `${brand}/videos/{topic}`,
  };
}

export const PIPELINES: PipelineDef[] = [
  {
    id: 'p1',
    name: 'Pipeline 1 — Orchestrator',
    trigger: 'Auto button',
    steps: [
      { id: 'ai1', label: 'AI 1 — checks', queue: 'research' },
      { id: 'gdrive', label: 'Goes to gDrive (per-company CSVs)', queue: 'drive-mirror' },
      {
        id: 'newcontact',
        label: 'Any new contact available?',
        decision: true,
        note: 'If yes → Pipeline 2 · If not → Pipeline 3',
      },
    ],
    branches: ['If yes → activate Pipeline 2', 'If not → activate Pipeline 3'],
  },
  {
    id: 'p2',
    name: 'Pipeline 2 — Video generation',
    trigger: 'New contact found',
    steps: [
      { id: 'takes', label: 'Takes that content', queue: 'generate-text' },
      { id: 'chardesign', label: 'Character design AI', queue: 'generate-image' },
      { id: 'charcontent', label: 'Characters + content', queue: 'generate-text' },
      { id: 'higgsfield', label: 'Higgsfield AI (video)', queue: 'generate-video' },
      { id: 'storevids', label: 'Stores videos in gDrive', queue: 'drive-mirror' },
    ],
  },
  {
    id: 'p3',
    name: 'Pipeline 3 — Research & content',
    trigger: 'No new contact',
    steps: [
      { id: 'market', label: 'Market research AI', queue: 'research' },
      { id: 'topics', label: 'Upload topics to gDrive CSVs', queue: 'drive-mirror' },
      { id: 'writing', label: 'Content writing AI', queue: 'generate-text' },
      { id: 'enrich', label: 'Enrich CSV → calls AI 1', queue: 'drive-mirror' },
    ],
  },
];

/** Every distinct queue referenced by the pipelines (for status polling). */
export const PIPELINE_QUEUES: JobName[] = Array.from(
  new Set(
    PIPELINES.flatMap((p) => p.steps.map((s) => s.queue).filter((q): q is JobName => !!q)),
  ),
);

/**
 * Which provider integrations are eligible to power each step, keyed by the
 * step's queue (its capability). Clicking a tile lets the operator pick one of
 * these and save its API key. Ids match the integrations registry.
 */
const PROVIDERS_BY_QUEUE: Partial<Record<JobName, string[]>> = {
  research: ['anthropic', 'openai', 'gemini', 'groq', 'openrouter', 'nvidia'],
  'generate-text': ['anthropic', 'openai', 'gemini', 'groq', 'openrouter', 'nvidia'],
  'generate-image': ['fal'],
  'generate-video': ['higgsfield', 'fal'],
  'drive-mirror': ['google_drive', 's3'],
};

/** Selectable models per provider (for the per-step model dropdown). */
export const MODELS_BY_PROVIDER: Record<string, string[]> = {
  anthropic: ['claude-opus-4-8', 'claude-sonnet-4-6', 'claude-haiku-4-5'],
  openai: ['gpt-5', 'gpt-5-mini'],
  gemini: ['gemini-2.5-pro', 'gemini-2.5-flash', 'gemini-2.5-flash-lite'],
  groq: ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'],
  openrouter: ['openrouter/auto'],
  nvidia: [
    'meta/llama-3.3-70b-instruct',
    'nvidia/llama-3.1-nemotron-70b-instruct',
    'deepseek-ai/deepseek-r1',
  ],
  fal: ['ideogram', 'flux', 'seedream'],
  higgsfield: ['see-dance-2.0'],
  google_drive: [],
  s3: [],
};

export function providerOptionsForStep(step: PipelineStep): string[] {
  return step.queue ? (PROVIDERS_BY_QUEUE[step.queue] ?? []) : [];
}

export function modelsForProvider(providerId: string): string[] {
  return MODELS_BY_PROVIDER[providerId] ?? [];
}

/** Flat list of every step id → its eligible providers (for validation). */
export const STEP_PROVIDER_OPTIONS: Record<string, string[]> = Object.fromEntries(
  PIPELINES.flatMap((p) => p.steps.map((s) => [s.id, providerOptionsForStep(s)] as const)),
);
