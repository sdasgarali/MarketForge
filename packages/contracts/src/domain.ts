import { z } from 'zod';
import {
  AgentType,
  AiProvider,
  AssetKind,
  CampaignStatus,
  CampaignType,
  ContentStatus,
  ContentType,
  LanguageCode,
  NotificationChannel,
  NotificationType,
  OrgRole,
  Platform,
  PublishStatus,
  ReviewStage,
  TrustTier,
} from './enums.js';
import { Json, Timezone, Usage, Uuid } from './common.js';

/**
 * Domain DTOs — the shared contract every app aligns to. Each entity has:
 *  - a full read shape (`<Entity>`)
 *  - a create input shape (`<Entity>CreateInput`) omitting server-managed fields
 * Server-managed fields (id, org_id derived from tenant ctx, timestamps) are not
 * part of create inputs.
 */

const auditFields = {
  id: Uuid,
  org_id: Uuid,
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }).optional(),
};

// ============================================================================
// ORGANIZATION / USER / MEMBERSHIP
// ============================================================================
export const Organization = z.object({
  id: Uuid,
  name: z.string().min(1),
  slug: z.string().min(1),
  plan: z.string().default('free'),
  clerk_org_id: z.string().optional(),
  status: z.enum(['active', 'suspended', 'deleted']).default('active'),
  settings: Json.optional(),
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }).optional(),
});
export type Organization = z.infer<typeof Organization>;

export const User = z.object({
  id: Uuid,
  clerk_user_id: z.string().optional(),
  email: z.string().email(),
  full_name: z.string().optional(),
  avatar_url: z.string().url().optional(),
  last_login_at: z.string().datetime({ offset: true }).optional(),
  created_at: z.string().datetime({ offset: true }),
});
export type User = z.infer<typeof User>;

export const OrgMembership = z.object({
  id: Uuid,
  org_id: Uuid,
  user_id: Uuid,
  role: OrgRole,
  invited_by: Uuid.optional(),
  status: z.enum(['active', 'invited', 'revoked']).default('active'),
  created_at: z.string().datetime({ offset: true }),
});
export type OrgMembership = z.infer<typeof OrgMembership>;

// ============================================================================
// BRAND — all profile fields from prompt.txt "Brand Management"
// ============================================================================
export const BrandColors = z
  .object({
    primary: z.string().optional(),
    secondary: z.string().optional(),
    accent: z.string().optional(),
  })
  .catchall(z.string());
export type BrandColors = z.infer<typeof BrandColors>;

export const ApprovalSettings = z.object({
  mode: z.enum(['auto', 'manual']).default('manual'),
  min_score: z.number().min(0).max(100).default(90),
  trust_tier: TrustTier.default('new'),
});
export type ApprovalSettings = z.infer<typeof ApprovalSettings>;

export const CharacterPreset = z.object({
  name: z.string(),
  description: z.string().optional(),
  clothing: z.string().optional(),
  colors: z.array(z.string()).optional(),
  accessories: z.array(z.string()).optional(),
  lighting: z.string().optional(),
  camera_angle: z.string().optional(),
  background: z.string().optional(),
  logo_placement: z.string().optional(),
  facial_expression: z.string().optional(),
  aspect_ratio: z.string().optional(),
  negative_prompt: z.string().optional(),
  reference_asset_ids: z.array(Uuid).optional(),
});
export type CharacterPreset = z.infer<typeof CharacterPreset>;

export const Brand = z.object({
  ...auditFields,
  company_name: z.string().min(1),
  website: z.string().url().optional(),
  industry: z.string().optional(),
  products: z.array(z.string()).default([]),
  services: z.array(z.string()).default([]),
  mission: z.string().optional(),
  vision: z.string().optional(),
  target_audience: Json.optional(),
  competitors: z.array(z.string()).default([]),
  logo_asset_id: Uuid.optional(),
  brand_colors: BrandColors.optional(),
  fonts: z.array(z.string()).default([]),
  icons: Json.optional(),
  brand_voice: z.string().optional(),
  writing_style: z.string().optional(),
  preferred_cta: z.string().optional(),
  negative_prompt: z.string().optional(),
  image_style: z.string().optional(),
  video_style: z.string().optional(),
  approved_characters: z.array(CharacterPreset).default([]),
  timezone: Timezone.default('UTC'),
  languages: z.array(LanguageCode).default(['en']),
  drive_folder_id: z.string().optional(),
  publishing_schedule: Json.optional(),
  approval_settings: ApprovalSettings.default({
    mode: 'manual',
    min_score: 90,
    trust_tier: 'new',
  }),
  knowledge_base: Json.optional(),
  status: z.enum(['active', 'paused', 'archived']).default('active'),
});
export type Brand = z.infer<typeof Brand>;

export const BrandCreateInput = Brand.omit({
  id: true,
  org_id: true,
  created_at: true,
  updated_at: true,
}).partial({
  products: true,
  services: true,
  competitors: true,
  fonts: true,
  approved_characters: true,
  timezone: true,
  languages: true,
  approval_settings: true,
  status: true,
});
export type BrandCreateInput = z.infer<typeof BrandCreateInput>;

// ============================================================================
// SOCIAL ACCOUNT
// ============================================================================
export const SocialAccount = z.object({
  ...auditFields,
  brand_id: Uuid,
  platform: Platform,
  handle: z.string().optional(),
  external_account_id: z.string().optional(),
  /** Pointer to encrypted credential row (never inline token). */
  credentials_ref: Uuid.optional(),
  /** Ayrshare per-brand profile key (ADR-003). */
  profile_key: z.string().optional(),
  connection_status: z.enum(['connected', 'disconnected', 'expired', 'error']).default('disconnected'),
  connected_at: z.string().datetime({ offset: true }).optional(),
  expires_at: z.string().datetime({ offset: true }).optional(),
});
export type SocialAccount = z.infer<typeof SocialAccount>;

// ============================================================================
// CAMPAIGN
// ============================================================================
export const Campaign = z.object({
  ...auditFields,
  brand_id: Uuid,
  name: z.string().min(1),
  campaign_type: CampaignType,
  platform: Platform.optional(),
  topic: z.string().optional(),
  priority: z.number().int().min(0).max(10).default(5),
  language: LanguageCode.default('en'),
  timezone: Timezone.default('UTC'),
  /** rrule/cron for recurring campaigns; shape is fluid → JSON. */
  schedule: Json.optional(),
  run_at: z.string().datetime({ offset: true }).optional(),
  status: CampaignStatus.default('draft'),
  retry_count: z.number().int().nonnegative().default(0),
  approval_required: z.boolean().default(true),
  auto_mode: z.boolean().default(false),
  created_by: Uuid.optional(),
});
export type Campaign = z.infer<typeof Campaign>;

export const CampaignCreateInput = Campaign.omit({
  id: true,
  org_id: true,
  created_at: true,
  updated_at: true,
  retry_count: true,
  status: true,
});
export type CampaignCreateInput = z.infer<typeof CampaignCreateInput>;

// ============================================================================
// CONTENT ITEM
// ============================================================================
export const ContentItem = z.object({
  ...auditFields,
  brand_id: Uuid,
  campaign_id: Uuid.optional(),
  platform: Platform,
  content_type: ContentType,
  language: LanguageCode.default('en'),
  title: z.string().optional(),
  body: z.string().optional(),
  caption: z.string().optional(),
  hashtags: z.array(z.string()).default([]),
  /** platform-specific fields (tags, cta, poll options, ...). */
  metadata: Json.optional(),
  status: ContentStatus.default('draft'),
  quality_score: z.number().min(0).max(100).optional(),
  parent_id: Uuid.optional(),
  version: z.number().int().positive().default(1),
  generated_at: z.string().datetime({ offset: true }).optional(),
});
export type ContentItem = z.infer<typeof ContentItem>;

export const ContentItemCreateInput = ContentItem.omit({
  id: true,
  org_id: true,
  created_at: true,
  updated_at: true,
  quality_score: true,
  generated_at: true,
}).partial({ hashtags: true, status: true, version: true, language: true });
export type ContentItemCreateInput = z.infer<typeof ContentItemCreateInput>;

// ============================================================================
// ASSET
// ============================================================================
export const Asset = z.object({
  ...auditFields,
  brand_id: Uuid,
  content_item_id: Uuid.optional(),
  kind: AssetKind,
  /** Canonical S3 key (system of record, ADR-006). */
  storage_key: z.string(),
  /** Google Drive mirror id (nullable until mirrored). */
  drive_file_id: z.string().optional(),
  mime_type: z.string().optional(),
  bytes: z.number().int().nonnegative().optional(),
  width: z.number().int().nonnegative().optional(),
  height: z.number().int().nonnegative().optional(),
  duration_ms: z.number().int().nonnegative().optional(),
  checksum: z.string().optional(),
  /** Generator model used to produce the asset. */
  model: z.string().optional(),
  status: z.enum(['pending', 'ready', 'mirrored', 'failed']).default('pending'),
});
export type Asset = z.infer<typeof Asset>;

// ============================================================================
// RESEARCH REPORT
// ============================================================================
export const ResearchReport = z.object({
  ...auditFields,
  brand_id: Uuid,
  campaign_id: Uuid.optional(),
  /** trends/news/reddit/x/linkedin/competitors/... */
  sources: Json.optional(),
  summary: z.string().optional(),
  keywords: z.array(z.string()).default([]),
  hashtags: z.array(z.string()).default([]),
  hooks: Json.optional(),
  pain_points: Json.optional(),
  search_intent: Json.optional(),
  raw: Json.optional(),
  created_by_agent: z.string().optional(),
});
export type ResearchReport = z.infer<typeof ResearchReport>;

// ============================================================================
// REVIEW RESULT — per-stage score + composite
// ============================================================================
export const ReviewResult = z.object({
  ...auditFields,
  content_item_id: Uuid,
  stage: ReviewStage,
  agent: z.string().optional(),
  score: z.number().min(0).max(100),
  passed: z.boolean(),
  findings: Json.optional(),
  model: z.string().optional(),
  tokens: z.number().int().nonnegative().optional(),
  cost_usd: z.number().nonnegative().optional(),
});
export type ReviewResult = z.infer<typeof ReviewResult>;

/**
 * Aggregate review verdict for a content item — the composite that gates
 * approval/regeneration (threshold default 90).
 */
export const CompositeReview = z.object({
  content_item_id: Uuid,
  /** Per-stage scores keyed by ReviewStage. */
  stage_scores: z.record(ReviewStage, z.number().min(0).max(100)),
  composite_score: z.number().min(0).max(100),
  passed: z.boolean(),
  threshold: z.number().min(0).max(100).default(90),
  failed_stages: z.array(ReviewStage).default([]),
});
export type CompositeReview = z.infer<typeof CompositeReview>;

// ============================================================================
// PUBLISH JOB
// ============================================================================
export const PublishJob = z.object({
  ...auditFields,
  brand_id: Uuid,
  content_item_id: Uuid,
  social_account_id: Uuid.optional(),
  platform: Platform,
  scheduled_at: z.string().datetime({ offset: true }).optional(),
  status: PublishStatus.default('pending'),
  retry_count: z.number().int().nonnegative().default(0),
  max_retries: z.number().int().nonnegative().default(5),
  external_post_id: z.string().optional(),
  post_url: z.string().url().optional(),
  published_at: z.string().datetime({ offset: true }).optional(),
  error: Json.optional(),
  bullmq_job_id: z.string().optional(),
});
export type PublishJob = z.infer<typeof PublishJob>;

// ============================================================================
// ANALYTICS RECORD
// ============================================================================
export const AnalyticsRecord = z.object({
  ...auditFields,
  brand_id: Uuid,
  content_item_id: Uuid.optional(),
  publish_job_id: Uuid.optional(),
  platform: Platform,
  captured_at: z.string().datetime({ offset: true }),
  views: z.number().int().nonnegative().optional(),
  reach: z.number().int().nonnegative().optional(),
  impressions: z.number().int().nonnegative().optional(),
  watch_time_ms: z.number().int().nonnegative().optional(),
  clicks: z.number().int().nonnegative().optional(),
  ctr: z.number().min(0).optional(),
  comments: z.number().int().nonnegative().optional(),
  likes: z.number().int().nonnegative().optional(),
  shares: z.number().int().nonnegative().optional(),
  followers_delta: z.number().int().optional(),
  engagement_rate: z.number().min(0).optional(),
  conversions: z.number().int().nonnegative().optional(),
  raw: Json.optional(),
});
export type AnalyticsRecord = z.infer<typeof AnalyticsRecord>;

// ============================================================================
// PROMPT TEMPLATE
// ============================================================================
export const PromptTemplate = z.object({
  id: Uuid,
  /** null org_id => global template shared across tenants. */
  org_id: Uuid.nullable(),
  brand_id: Uuid.nullable().optional(),
  name: z.string().min(1),
  agent_type: AgentType,
  version: z.number().int().positive().default(1),
  body: z.string(),
  variables: Json.optional(),
  is_active: z.boolean().default(true),
  created_by: Uuid.optional(),
  created_at: z.string().datetime({ offset: true }),
});
export type PromptTemplate = z.infer<typeof PromptTemplate>;

// ============================================================================
// AI AGENT CONFIG (DB-driven, not hardcoded)
// ============================================================================
export const AiAgentConfig = z.object({
  ...auditFields,
  brand_id: Uuid.nullable().optional(),
  agent_type: AgentType,
  provider: AiProvider,
  model: z.string(),
  params: Json.optional(),
  /** Ordered provider fallbacks (routing, ADR-007). */
  fallback_chain: z.array(z.object({ provider: AiProvider, model: z.string() })).default([]),
  enabled: z.boolean().default(true),
});
export type AiAgentConfig = z.infer<typeof AiAgentConfig>;

// ============================================================================
// NOTIFICATION
// ============================================================================
export const Notification = z.object({
  id: Uuid,
  org_id: Uuid,
  user_id: Uuid.nullable().optional(),
  channel: NotificationChannel,
  type: NotificationType,
  title: z.string(),
  body: z.string().optional(),
  payload: Json.optional(),
  read_at: z.string().datetime({ offset: true }).optional(),
  sent_at: z.string().datetime({ offset: true }).optional(),
  created_at: z.string().datetime({ offset: true }),
});
export type Notification = z.infer<typeof Notification>;

/** Re-export Usage for convenience at the domain boundary. */
export { Usage };
