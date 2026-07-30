import { z } from 'zod';

/**
 * Shared domain enums. Kept as Zod enums so they serve both runtime validation
 * and static types (via z.infer). Values are the canonical strings persisted in
 * Postgres and passed across service/queue boundaries.
 */

// --- RBAC (ADR-002; Clerk roles mirrored to Postgres) ---
export const OrgRole = z.enum(['admin', 'manager', 'editor', 'viewer']);
export type OrgRole = z.infer<typeof OrgRole>;

/** Role precedence for `requireRole` (higher index = more privilege). */
export const ORG_ROLE_RANK: Record<OrgRole, number> = {
  viewer: 0,
  editor: 1,
  manager: 2,
  admin: 3,
};

// --- Platforms. Full roster; MVP enables x + instagram only (CLAUDE.md). ---
export const Platform = z.enum(['x', 'instagram', 'facebook', 'linkedin', 'youtube', 'tiktok']);
export type Platform = z.infer<typeof Platform>;

/** MVP-enabled subset (least-gated). */
export const MVP_PLATFORMS: readonly Platform[] = ['x', 'instagram'] as const;

// --- Campaign types (scheduling engine; no hardcoded schedules) ---
export const CampaignType = z.enum([
  'one_time',
  'recurring',
  'weekly',
  'monthly',
  'daily',
  'holiday',
  'launch',
  'emergency',
]);
export type CampaignType = z.infer<typeof CampaignType>;

export const CampaignStatus = z.enum([
  'draft',
  'queued',
  'running',
  'paused',
  'done',
  'failed',
]);
export type CampaignStatus = z.infer<typeof CampaignStatus>;

// --- Content lifecycle status (drives the approval/publish state machine) ---
export const ContentStatus = z.enum([
  'draft',
  'researching',
  'generating',
  'review',
  'approved',
  'scheduled',
  'publishing',
  'published',
  'failed',
  'needs_media',
]);
export type ContentStatus = z.infer<typeof ContentStatus>;

export const ContentType = z.enum([
  'post',
  'reel',
  'short',
  'thread',
  'carousel',
  'article',
  'story',
  'video',
]);
export type ContentType = z.infer<typeof ContentType>;

// --- Per-brand trust tier (auto-publish graduation, CLAUDE.md publish policy) ---
export const TrustTier = z.enum(['new', 'reviewed', 'trusted', 'auto']);
export type TrustTier = z.infer<typeof TrustTier>;

// --- Asset kinds ---
export const AssetKind = z.enum([
  'image',
  'video',
  'gif',
  'audio',
  'subtitle',
  'thumbnail',
  'doc',
]);
export type AssetKind = z.infer<typeof AssetKind>;

// --- Review stages (multi-stage AI QA; composite score) ---
export const ReviewStage = z.enum([
  'grammar',
  'fact',
  'brand',
  'copyright',
  'seo',
  'visual',
  'marketing',
  'policy',
  'duplicate',
  'accessibility',
]);
export type ReviewStage = z.infer<typeof ReviewStage>;

export const REVIEW_STAGES: readonly ReviewStage[] = ReviewStage.options;

// --- Publish job status ---
export const PublishStatus = z.enum([
  'pending',
  'publishing',
  'published',
  'failed',
  'cancelled',
]);
export type PublishStatus = z.infer<typeof PublishStatus>;

// --- AI agent types (DB-driven agent config; not hardcoded) ---
export const AgentType = z.enum([
  'research',
  'seo',
  'strategist',
  'content_planner',
  'copywriter',
  'script_writer',
  'fact_checker',
  'grammar_checker',
  'brand_compliance',
  'visual_director',
  'thumbnail_designer',
  'character_designer',
  'image_prompt_engineer',
  'video_prompt_engineer',
  'voiceover_writer',
  'subtitle_generator',
  'hashtag_generator',
  'publishing_manager',
  'analytics',
  'performance_optimizer',
  'prompt_optimizer',
  'error_recovery',
  'cost_optimizer',
  'quality_assurance',
]);
export type AgentType = z.infer<typeof AgentType>;

// --- AI provider identifiers (adapter routing) ---
export const AiProvider = z.enum([
  'anthropic',
  'openai',
  'gemini',
  'groq',
  'openrouter',
  'ollama',
  'fal',
  'elevenlabs',
]);
export type AiProvider = z.infer<typeof AiProvider>;

// --- LLM routing task hint (task/cost routing, ADR-007) ---
export const LlmTask = z.enum([
  'copywriting',
  'review',
  'reasoning',
  'bulk_tags',
  'summarize',
  'research',
]);
export type LlmTask = z.infer<typeof LlmTask>;

// --- Notification channels + types ---
export const NotificationChannel = z.enum([
  'email',
  'slack',
  'discord',
  'telegram',
  'dashboard',
]);
export type NotificationChannel = z.infer<typeof NotificationChannel>;

export const NotificationType = z.enum([
  'success',
  'failure',
  'warning',
  'approval',
  'queue_status',
]);
export type NotificationType = z.infer<typeof NotificationType>;

// --- Language codes (loose ISO-ish; brands often multilingual) ---
export const LanguageCode = z.string().min(2).max(10);
export type LanguageCode = z.infer<typeof LanguageCode>;
