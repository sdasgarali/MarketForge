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

/** Companies whose CSVs / assets the pipelines fan out across. */
export const COMPANIES = ['Neuraforz', 'Exzelon', 'Medeoan', 'Tavakkul'] as const;

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
  research: ['anthropic', 'openai', 'gemini', 'groq', 'openrouter'],
  'generate-text': ['anthropic', 'openai', 'gemini', 'groq', 'openrouter'],
  'generate-image': ['fal'],
  'generate-video': ['higgsfield', 'fal'],
  'drive-mirror': ['google_drive', 's3'],
};

export function providerOptionsForStep(step: PipelineStep): string[] {
  return step.queue ? (PROVIDERS_BY_QUEUE[step.queue] ?? []) : [];
}

/** Flat list of every step id → its eligible providers (for validation). */
export const STEP_PROVIDER_OPTIONS: Record<string, string[]> = Object.fromEntries(
  PIPELINES.flatMap((p) => p.steps.map((s) => [s.id, providerOptionsForStep(s)] as const)),
);
