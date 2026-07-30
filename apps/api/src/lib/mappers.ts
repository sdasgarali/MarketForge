/**
 * Row → DTO mappers. Drizzle rows are camelCase with jsonb columns typed as
 * `unknown`; API responses use the snake_case contract shapes. These mappers are
 * the single translation boundary so controllers stay clean. They are lenient on
 * jsonb (cast through the contract's Json/loose types) and normalize timestamps
 * to ISO strings.
 */
import type {
  AnalyticsRow,
  BrandRow,
  CampaignRow,
  ContentItemRow,
  NotificationRow,
  PromptTemplateRow,
  ReviewResultRow,
  SocialAccountRow,
} from '@marketforge/db';

function iso(v: Date | string | null | undefined): string | undefined {
  if (v == null) return undefined;
  return v instanceof Date ? v.toISOString() : v;
}

function num(v: unknown): number | undefined {
  if (v == null) return undefined;
  const n = typeof v === 'number' ? v : Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/** Drop undefined values so JSON responses stay tidy. */
function clean<T extends Record<string, unknown>>(obj: T): T {
  for (const k of Object.keys(obj)) {
    if (obj[k] === undefined) delete obj[k];
  }
  return obj;
}

export function brandToDto(r: BrandRow) {
  return clean({
    id: r.id,
    org_id: r.orgId,
    company_name: r.companyName,
    website: r.website ?? undefined,
    industry: r.industry ?? undefined,
    products: r.products ?? [],
    services: r.services ?? [],
    mission: r.mission ?? undefined,
    vision: r.vision ?? undefined,
    target_audience: r.targetAudience ?? undefined,
    competitors: r.competitors ?? [],
    logo_asset_id: r.logoAssetId ?? undefined,
    brand_colors: r.brandColors ?? undefined,
    fonts: r.fonts ?? [],
    icons: r.icons ?? undefined,
    brand_voice: r.brandVoice ?? undefined,
    writing_style: r.writingStyle ?? undefined,
    preferred_cta: r.preferredCta ?? undefined,
    negative_prompt: r.negativePrompt ?? undefined,
    image_style: r.imageStyle ?? undefined,
    video_style: r.videoStyle ?? undefined,
    approved_characters: r.approvedCharacters ?? [],
    timezone: r.timezone ?? 'UTC',
    languages: r.languages ?? ['en'],
    drive_folder_id: r.driveFolderId ?? undefined,
    publishing_schedule: r.publishingSchedule ?? undefined,
    approval_settings: r.approvalSettings ?? undefined,
    knowledge_base: r.knowledgeBase ?? undefined,
    status: r.status,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
  });
}

export function socialAccountToDto(r: SocialAccountRow) {
  return clean({
    id: r.id,
    org_id: r.orgId,
    brand_id: r.brandId,
    platform: r.platform,
    handle: r.handle ?? undefined,
    external_account_id: r.externalAccountId ?? undefined,
    credentials_ref: r.credentialsRef ?? undefined,
    profile_key: r.profileKey ?? undefined,
    connection_status: r.connectionStatus,
    connected_at: iso(r.connectedAt),
    expires_at: iso(r.expiresAt),
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
  });
}

export function campaignToDto(r: CampaignRow) {
  return clean({
    id: r.id,
    org_id: r.orgId,
    brand_id: r.brandId,
    name: r.name,
    campaign_type: r.campaignType,
    platform: r.platform ?? undefined,
    topic: r.topic ?? undefined,
    priority: r.priority,
    language: r.language ?? 'en',
    timezone: r.timezone ?? 'UTC',
    schedule: r.schedule ?? undefined,
    run_at: iso(r.runAt),
    status: r.status,
    retry_count: r.retryCount,
    approval_required: r.approvalRequired,
    auto_mode: r.autoMode,
    created_by: r.createdBy ?? undefined,
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
  });
}

export function contentItemToDto(r: ContentItemRow) {
  return clean({
    id: r.id,
    org_id: r.orgId,
    brand_id: r.brandId,
    campaign_id: r.campaignId ?? undefined,
    platform: r.platform,
    content_type: r.contentType,
    language: r.language ?? 'en',
    title: r.title ?? undefined,
    body: r.body ?? undefined,
    caption: r.caption ?? undefined,
    hashtags: r.hashtags ?? [],
    metadata: r.metadata ?? undefined,
    status: r.status,
    quality_score: num(r.qualityScore),
    parent_id: r.parentId ?? undefined,
    version: r.version,
    generated_at: iso(r.generatedAt),
    created_at: iso(r.createdAt),
    updated_at: iso(r.updatedAt),
  });
}

export function reviewResultToDto(r: ReviewResultRow) {
  return clean({
    id: r.id,
    org_id: r.orgId,
    content_item_id: r.contentItemId,
    stage: r.stage,
    agent: r.agent ?? undefined,
    score: num(r.score),
    passed: r.passed,
    findings: r.findings ?? undefined,
    model: r.model ?? undefined,
    tokens: r.tokens ?? undefined,
    cost_usd: num(r.costUsd),
    created_at: iso(r.createdAt),
  });
}

export function promptTemplateToDto(r: PromptTemplateRow) {
  return clean({
    id: r.id,
    org_id: r.orgId,
    brand_id: r.brandId ?? undefined,
    name: r.name,
    agent_type: r.agentType,
    version: r.version,
    body: r.body,
    variables: r.variables ?? undefined,
    is_active: r.isActive,
    created_at: iso(r.createdAt),
  });
}

export function analyticsToDto(r: AnalyticsRow) {
  return clean({
    id: r.id,
    org_id: r.orgId,
    brand_id: r.brandId,
    content_item_id: r.contentItemId ?? undefined,
    publish_job_id: r.publishJobId ?? undefined,
    platform: r.platform,
    captured_at: iso(r.capturedAt),
    views: r.views ?? undefined,
    reach: r.reach ?? undefined,
    impressions: r.impressions ?? undefined,
    watch_time_ms: r.watchTimeMs ?? undefined,
    clicks: r.clicks ?? undefined,
    ctr: num(r.ctr),
    comments: r.comments ?? undefined,
    likes: r.likes ?? undefined,
    shares: r.shares ?? undefined,
    followers_delta: r.followersDelta ?? undefined,
    engagement_rate: num(r.engagementRate),
    conversions: r.conversions ?? undefined,
    raw: r.raw ?? undefined,
    created_at: iso(r.createdAt),
  });
}

export function notificationToDto(r: NotificationRow) {
  return clean({
    id: r.id,
    org_id: r.orgId,
    user_id: r.userId ?? undefined,
    channel: r.channel,
    type: r.type,
    title: r.title,
    body: r.body ?? undefined,
    payload: r.payload ?? undefined,
    read_at: iso(r.readAt),
    sent_at: iso(r.sentAt),
    created_at: iso(r.createdAt),
  });
}
