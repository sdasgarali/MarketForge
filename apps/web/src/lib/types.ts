/**
 * Local mirror of `@marketforge/contracts` DTO/enum types.
 *
 * We intentionally redeclare types here (rather than importing the workspace
 * package) so the web bundle never pulls server-side zod schemas, and so the
 * app builds standalone. These MUST stay in sync with
 * `packages/contracts/src/{enums,domain,common}.ts` — the single source of truth.
 */

// --- Enums (string unions mirror contracts z.enum values) -------------------
export type OrgRole = 'admin' | 'manager' | 'editor' | 'viewer';

export type Platform =
  | 'x'
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'youtube'
  | 'tiktok';

export const MVP_PLATFORMS: readonly Platform[] = ['x', 'instagram'];

export type CampaignType =
  | 'one_time'
  | 'recurring'
  | 'weekly'
  | 'monthly'
  | 'daily'
  | 'holiday'
  | 'launch'
  | 'emergency';

export type CampaignStatus =
  | 'draft'
  | 'queued'
  | 'running'
  | 'paused'
  | 'done'
  | 'failed';

export type ContentStatus =
  | 'draft'
  | 'researching'
  | 'generating'
  | 'review'
  | 'approved'
  | 'scheduled'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'needs_media';

export type ContentType =
  | 'post'
  | 'reel'
  | 'short'
  | 'thread'
  | 'carousel'
  | 'article'
  | 'story'
  | 'video';

export type TrustTier = 'new' | 'reviewed' | 'trusted' | 'auto';

export type AssetKind =
  | 'image'
  | 'video'
  | 'gif'
  | 'audio'
  | 'subtitle'
  | 'thumbnail'
  | 'doc';

export type ReviewStage =
  | 'grammar'
  | 'fact'
  | 'brand'
  | 'copyright'
  | 'seo'
  | 'visual'
  | 'marketing'
  | 'policy'
  | 'duplicate'
  | 'accessibility';

export const REVIEW_STAGES: readonly ReviewStage[] = [
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
];

export type PublishStatus =
  | 'pending'
  | 'publishing'
  | 'published'
  | 'failed'
  | 'cancelled';

export type NotificationChannel =
  | 'email'
  | 'slack'
  | 'discord'
  | 'telegram'
  | 'dashboard';

export type NotificationType =
  | 'success'
  | 'failure'
  | 'warning'
  | 'approval'
  | 'queue_status';

export type Json =
  | string
  | number
  | boolean
  | null
  | { [k: string]: Json }
  | Json[];

// --- Domain DTOs ------------------------------------------------------------
export interface Organization {
  id: string;
  name: string;
  slug: string;
  plan: string;
  clerk_org_id?: string;
  status: 'active' | 'suspended' | 'deleted';
  settings?: Json;
  created_at: string;
  updated_at?: string;
}

export interface User {
  id: string;
  clerk_user_id?: string;
  email: string;
  full_name?: string;
  avatar_url?: string;
  last_login_at?: string;
  created_at: string;
}

export interface MeResponse {
  user: User;
  org: Organization;
  role: OrgRole;
  memberships: { org: Organization; role: OrgRole }[];
}

export interface BrandColors {
  primary?: string;
  secondary?: string;
  accent?: string;
  [k: string]: string | undefined;
}

export interface ApprovalSettings {
  mode: 'auto' | 'manual';
  min_score: number;
  trust_tier: TrustTier;
}

export interface CharacterPreset {
  name: string;
  description?: string;
  clothing?: string;
  colors?: string[];
  accessories?: string[];
  lighting?: string;
  camera_angle?: string;
  background?: string;
  logo_placement?: string;
  facial_expression?: string;
  aspect_ratio?: string;
  negative_prompt?: string;
  reference_asset_ids?: string[];
}

export interface Brand {
  id: string;
  org_id: string;
  created_at: string;
  updated_at?: string;
  company_name: string;
  website?: string;
  industry?: string;
  products: string[];
  services: string[];
  mission?: string;
  vision?: string;
  target_audience?: Json;
  competitors: string[];
  logo_asset_id?: string;
  brand_colors?: BrandColors;
  fonts: string[];
  icons?: Json;
  brand_voice?: string;
  writing_style?: string;
  preferred_cta?: string;
  negative_prompt?: string;
  image_style?: string;
  video_style?: string;
  approved_characters: CharacterPreset[];
  timezone: string;
  languages: string[];
  drive_folder_id?: string;
  publishing_schedule?: Json;
  approval_settings: ApprovalSettings;
  knowledge_base?: Json;
  status: 'active' | 'paused' | 'archived';
}

export type BrandCreateInput = Partial<
  Omit<Brand, 'id' | 'org_id' | 'created_at' | 'updated_at'>
> & { company_name: string };

export interface SocialAccount {
  id: string;
  org_id: string;
  created_at: string;
  updated_at?: string;
  brand_id: string;
  platform: Platform;
  handle?: string;
  external_account_id?: string;
  credentials_ref?: string;
  profile_key?: string;
  connection_status: 'connected' | 'disconnected' | 'expired' | 'error';
  connected_at?: string;
  expires_at?: string;
}

export interface Campaign {
  id: string;
  org_id: string;
  created_at: string;
  updated_at?: string;
  brand_id: string;
  name: string;
  campaign_type: CampaignType;
  platform?: Platform;
  topic?: string;
  priority: number;
  language: string;
  timezone: string;
  schedule?: Json;
  run_at?: string;
  status: CampaignStatus;
  retry_count: number;
  approval_required: boolean;
  auto_mode: boolean;
  created_by?: string;
}

export type CampaignCreateInput = Omit<
  Campaign,
  'id' | 'org_id' | 'created_at' | 'updated_at' | 'retry_count' | 'status'
>;

export interface ContentItem {
  id: string;
  org_id: string;
  created_at: string;
  updated_at?: string;
  brand_id: string;
  campaign_id?: string;
  platform: Platform;
  content_type: ContentType;
  language: string;
  title?: string;
  body?: string;
  caption?: string;
  hashtags: string[];
  metadata?: Json;
  status: ContentStatus;
  quality_score?: number;
  parent_id?: string;
  version: number;
  generated_at?: string;
  scheduled_at?: string;
  /** Convenience: resolved primary image URL (server may inline the asset). */
  image_url?: string;
}

export interface ReviewResult {
  id: string;
  content_item_id: string;
  stage: ReviewStage;
  agent?: string;
  score: number;
  passed: boolean;
  findings?: Json;
  model?: string;
  tokens?: number;
  cost_usd?: number;
  created_at: string;
}

export interface CompositeReview {
  content_item_id: string;
  stage_scores: Partial<Record<ReviewStage, number>>;
  composite_score: number;
  passed: boolean;
  threshold: number;
  failed_stages: ReviewStage[];
}

/** An approval-queue row: the content item plus its review verdict + brand ctx. */
export interface ApprovalItem {
  content_item: ContentItem;
  composite: CompositeReview;
  reviews: ReviewResult[];
  brand_name: string;
}

export interface AnalyticsRecord {
  id: string;
  org_id: string;
  created_at: string;
  brand_id: string;
  content_item_id?: string;
  publish_job_id?: string;
  platform: Platform;
  captured_at: string;
  views?: number;
  reach?: number;
  impressions?: number;
  watch_time_ms?: number;
  clicks?: number;
  ctr?: number;
  comments?: number;
  likes?: number;
  shares?: number;
  followers_delta?: number;
  engagement_rate?: number;
  conversions?: number;
}

/** Aggregated analytics rollup returned by GET /analytics. */
export interface AnalyticsSummary {
  by_platform: {
    platform: Platform;
    impressions: number;
    reach: number;
    likes: number;
    comments: number;
    shares: number;
    clicks: number;
    engagement_rate: number;
    posts: number;
  }[];
  timeseries: {
    date: string;
    impressions: number;
    engagement: number;
    clicks: number;
  }[];
  totals: {
    impressions: number;
    engagement: number;
    followers_delta: number;
    posts: number;
  };
}

export interface PromptTemplate {
  id: string;
  org_id: string | null;
  brand_id?: string | null;
  name: string;
  agent_type: string;
  version: number;
  body: string;
  variables?: Json;
  is_active: boolean;
  created_by?: string;
  created_at: string;
}

export interface Notification {
  id: string;
  org_id: string;
  user_id?: string | null;
  channel: NotificationChannel;
  type: NotificationType;
  title: string;
  body?: string;
  payload?: Json;
  read_at?: string;
  sent_at?: string;
  created_at: string;
}

export interface DashboardSummary {
  content_by_status: Partial<Record<ContentStatus, number>>;
  upcoming_scheduled: {
    id: string;
    title: string;
    platform: Platform;
    brand_name: string;
    scheduled_at: string;
  }[];
  recent_publishes: {
    id: string;
    title: string;
    platform: Platform;
    brand_name: string;
    published_at: string;
    post_url?: string;
  }[];
  spend_usd_30d: number;
  spend_series: { date: string; usd: number }[];
  activity: {
    id: string;
    type: NotificationType;
    title: string;
    body?: string;
    created_at: string;
  }[];
  counts: {
    brands: number;
    active_campaigns: number;
    pending_approvals: number;
    published_30d: number;
  };
}

// --- List envelope (mirrors contracts `paginated`) --------------------------
export interface Paginated<T> {
  items: T[];
  total: number;
  limit: number;
  offset: number;
}
