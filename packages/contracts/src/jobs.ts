import { z } from 'zod';
import { Platform } from './enums.js';
import { Json, Uuid } from './common.js';

/**
 * Queue job names (ADR-008). One BullMQ queue per JobName. These string values
 * ARE the queue names — keep them stable; workers register processors by them.
 */
export const JobName = z.enum([
  'research',
  'generate-text',
  'generate-image',
  'generate-video',
  'review',
  'publish',
  'analytics',
  'drive-mirror',
  'notify',
]);
export type JobName = z.infer<typeof JobName>;

export const JOB_NAMES: readonly JobName[] = JobName.options;

/**
 * Every job payload carries tenant context so workers can `SET LOCAL
 * app.current_org` (ADR-001) before any DB access. `idempotency_key` lets the
 * backend-owned scheduler dedupe delayed enqueues (ADR-004).
 */
export const JobBase = z.object({
  org_id: Uuid,
  brand_id: Uuid.optional(),
  campaign_id: Uuid.optional(),
  request_id: z.string().optional(),
  idempotency_key: z.string().optional(),
  /** For output versioning / regen loops. */
  attempt_reason: z.enum(['initial', 'retry', 'regeneration', 'manual']).default('initial'),
});
export type JobBase = z.infer<typeof JobBase>;

// --- research ---
export const ResearchJobPayload = JobBase.extend({
  topic: z.string().optional(),
  platform: Platform.optional(),
  sources: z.array(z.string()).optional(),
});
export type ResearchJobPayload = z.infer<typeof ResearchJobPayload>;

// --- generate-text ---
export const GenerateTextJobPayload = JobBase.extend({
  content_item_id: Uuid.optional(),
  platform: Platform,
  content_type: z.string(),
  research_report_id: Uuid.optional(),
  language: z.string().default('en'),
  prompt_template_id: Uuid.optional(),
});
export type GenerateTextJobPayload = z.infer<typeof GenerateTextJobPayload>;

// --- generate-image ---
export const GenerateImageJobPayload = JobBase.extend({
  content_item_id: Uuid.optional(),
  prompt: z.string(),
  negative_prompt: z.string().optional(),
  aspect_ratio: z.string().optional(),
  character_preset: z.string().optional(),
  count: z.number().int().positive().max(10).default(1),
  model_hint: z.string().optional(),
});
export type GenerateImageJobPayload = z.infer<typeof GenerateImageJobPayload>;

// --- generate-video (Phase 3, metered) ---
export const GenerateVideoJobPayload = JobBase.extend({
  content_item_id: Uuid.optional(),
  prompt: z.string(),
  duration_s: z.number().positive().max(60).default(5),
  with_audio: z.boolean().default(false),
  model_hint: z.string().optional(),
});
export type GenerateVideoJobPayload = z.infer<typeof GenerateVideoJobPayload>;

// --- review ---
export const ReviewJobPayload = JobBase.extend({
  content_item_id: Uuid,
  /** Optional subset of stages; default = all stages. */
  stages: z.array(z.string()).optional(),
  threshold: z.number().min(0).max(100).default(90),
});
export type ReviewJobPayload = z.infer<typeof ReviewJobPayload>;

// --- publish ---
export const PublishJobPayload = JobBase.extend({
  content_item_id: Uuid,
  publish_job_id: Uuid.optional(),
  platforms: z.array(Platform).min(1),
  social_account_id: Uuid.optional(),
  /** Aggregator per-brand profile key (ADR-003). */
  profile_key: z.string().optional(),
  scheduled_at: z.string().datetime({ offset: true }).optional(),
});
export type PublishJobPayload = z.infer<typeof PublishJobPayload>;

// --- analytics ---
export const AnalyticsJobPayload = JobBase.extend({
  publish_job_id: Uuid.optional(),
  content_item_id: Uuid.optional(),
  platform: Platform.optional(),
});
export type AnalyticsJobPayload = z.infer<typeof AnalyticsJobPayload>;

// --- drive-mirror ---
export const DriveMirrorJobPayload = JobBase.extend({
  asset_id: Uuid,
  storage_key: z.string(),
  drive_folder_id: z.string().optional(),
});
export type DriveMirrorJobPayload = z.infer<typeof DriveMirrorJobPayload>;

// --- notify ---
export const NotifyJobPayload = JobBase.extend({
  user_id: Uuid.optional(),
  channel: z.enum(['email', 'slack', 'discord', 'telegram', 'dashboard']),
  type: z.enum(['success', 'failure', 'warning', 'approval', 'queue_status']),
  title: z.string(),
  body: z.string().optional(),
  payload: Json.optional(),
});
export type NotifyJobPayload = z.infer<typeof NotifyJobPayload>;

/**
 * Master map: JobName -> its payload schema. The queue package uses this for
 * typed enqueue helpers; workers use it to validate incoming jobs.
 */
export const JOB_PAYLOAD_SCHEMAS = {
  research: ResearchJobPayload,
  'generate-text': GenerateTextJobPayload,
  'generate-image': GenerateImageJobPayload,
  'generate-video': GenerateVideoJobPayload,
  review: ReviewJobPayload,
  publish: PublishJobPayload,
  analytics: AnalyticsJobPayload,
  'drive-mirror': DriveMirrorJobPayload,
  notify: NotifyJobPayload,
} as const satisfies Record<JobName, z.ZodTypeAny>;

/** Typed map from JobName to its inferred payload type. */
export interface JobPayloadMap {
  research: ResearchJobPayload;
  'generate-text': GenerateTextJobPayload;
  'generate-image': GenerateImageJobPayload;
  'generate-video': GenerateVideoJobPayload;
  review: ReviewJobPayload;
  publish: PublishJobPayload;
  analytics: AnalyticsJobPayload;
  'drive-mirror': DriveMirrorJobPayload;
  notify: NotifyJobPayload;
}

/** Payload type for a given job name. */
export type PayloadFor<N extends JobName> = JobPayloadMap[N];
