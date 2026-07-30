import {
  bigint,
  bigserial,
  boolean,
  customType,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, orgId, pk, updatedAt } from './_shared.js';
import { brands, socialAccounts } from './brands.js';
import { contentItems } from './content.js';
import { organizations, users } from './tenancy.js';

/**
 * Operational tables: publishing, analytics, prompt/agent config, encrypted
 * credentials, audit trail, notifications. All tenant-scoped except where a
 * column is explicitly nullable to allow global/system-owned rows.
 */

/** Postgres `bytea` — Drizzle has no first-class bytea builder; map to Buffer. */
const bytea = customType<{ data: Buffer; driverData: Buffer }>({
  dataType() {
    return 'bytea';
  },
});

export const publishJobs = pgTable(
  'publish_jobs',
  {
    id: pk(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    contentItemId: uuid('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    socialAccountId: uuid('social_account_id').references(
      () => socialAccounts.id,
      { onDelete: 'set null' },
    ),
    platform: text('platform'),
    scheduledAt: timestamp('scheduled_at', { withTimezone: true }),
    status: text('status').notNull().default('pending'),
    retryCount: integer('retry_count').notNull().default(0),
    maxRetries: integer('max_retries').notNull().default(5),
    externalPostId: text('external_post_id'),
    postUrl: text('post_url'),
    publishedAt: timestamp('published_at', { withTimezone: true }),
    error: jsonb('error'),
    bullmqJobId: text('bullmq_job_id'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('publish_jobs_org_id_idx').on(t.orgId),
    index('publish_jobs_brand_id_idx').on(t.brandId),
    index('publish_jobs_content_item_id_idx').on(t.contentItemId),
    index('publish_jobs_status_idx').on(t.status),
    index('publish_jobs_scheduled_at_idx').on(t.scheduledAt),
  ],
);

export const analytics = pgTable(
  'analytics',
  {
    id: pk(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    contentItemId: uuid('content_item_id').references(() => contentItems.id, {
      onDelete: 'set null',
    }),
    publishJobId: uuid('publish_job_id').references(() => publishJobs.id, {
      onDelete: 'set null',
    }),
    platform: text('platform'),
    capturedAt: timestamp('captured_at', { withTimezone: true }),
    views: bigint('views', { mode: 'number' }),
    reach: bigint('reach', { mode: 'number' }),
    impressions: bigint('impressions', { mode: 'number' }),
    watchTimeMs: bigint('watch_time_ms', { mode: 'number' }),
    clicks: bigint('clicks', { mode: 'number' }),
    ctr: numeric('ctr'),
    comments: bigint('comments', { mode: 'number' }),
    likes: bigint('likes', { mode: 'number' }),
    shares: bigint('shares', { mode: 'number' }),
    followersDelta: bigint('followers_delta', { mode: 'number' }),
    engagementRate: numeric('engagement_rate'),
    conversions: bigint('conversions', { mode: 'number' }),
    raw: jsonb('raw'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('analytics_org_id_idx').on(t.orgId),
    index('analytics_brand_id_idx').on(t.brandId),
    index('analytics_content_item_id_idx').on(t.contentItemId),
    index('analytics_publish_job_id_idx').on(t.publishJobId),
    index('analytics_captured_at_idx').on(t.capturedAt),
  ],
);

/**
 * Prompt templates. org_id + brand_id are NULLABLE so global/system templates
 * can exist. NOTE: nullable org_id means the RLS policy `org_id = current_org`
 * will EXCLUDE global (org_id IS NULL) rows from normal tenant access — global
 * templates are managed by the admin/owner role, which bypasses via FORCE only
 * for the owner. Reads of global rows for tenants should go through a dedicated
 * SECURITY DEFINER function or a policy extension if/when required.
 */
export const promptTemplates = pgTable(
  'prompt_templates',
  {
    id: pk(),
    orgId: uuid('org_id').references(() => organizations.id, {
      onDelete: 'cascade',
    }),
    brandId: uuid('brand_id').references(() => brands.id, {
      onDelete: 'cascade',
    }),
    name: text('name').notNull(),
    agentType: text('agent_type'),
    version: integer('version').notNull().default(1),
    body: text('body'),
    variables: jsonb('variables'),
    isActive: boolean('is_active').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('prompt_templates_org_id_idx').on(t.orgId),
    index('prompt_templates_brand_id_idx').on(t.brandId),
    index('prompt_templates_agent_type_idx').on(t.agentType),
  ],
);

export const aiAgentConfigs = pgTable(
  'ai_agent_configs',
  {
    id: pk(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    brandId: uuid('brand_id').references(() => brands.id, {
      onDelete: 'cascade',
    }),
    agentType: text('agent_type').notNull(),
    provider: text('provider'),
    model: text('model'),
    params: jsonb('params'),
    fallbackChain: jsonb('fallback_chain'),
    enabled: boolean('enabled').notNull().default(true),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('ai_agent_configs_org_id_idx').on(t.orgId),
    index('ai_agent_configs_brand_id_idx').on(t.brandId),
    index('ai_agent_configs_agent_type_idx').on(t.agentType),
  ],
);

/** Envelope-encrypted secrets store. Ciphertext + wrapped DEK live here. */
export const apiCredentials = pgTable(
  'api_credentials',
  {
    id: pk(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    brandId: uuid('brand_id').references(() => brands.id, {
      onDelete: 'cascade',
    }),
    kind: text('kind').notNull(),
    label: text('label'),
    ciphertext: bytea('ciphertext').notNull(),
    iv: bytea('iv').notNull(),
    authTag: bytea('auth_tag').notNull(),
    dekWrapped: bytea('dek_wrapped').notNull(),
    kekId: text('kek_id'),
    rotatedAt: timestamp('rotated_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('api_credentials_org_id_idx').on(t.orgId),
    index('api_credentials_brand_id_idx').on(t.brandId),
    index('api_credentials_kind_idx').on(t.kind),
  ],
);

/** Append-only audit trail. bigserial PK (high-volume, ordered). */
export const auditLogs = pgTable(
  'audit_logs',
  {
    id: bigserial('id', { mode: 'number' }).primaryKey(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    actorUserId: uuid('actor_user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    actorType: text('actor_type'),
    action: text('action').notNull(),
    entityType: text('entity_type'),
    entityId: text('entity_id'),
    before: jsonb('before'),
    after: jsonb('after'),
    ip: text('ip'),
    userAgent: text('user_agent'),
    createdAt: createdAt(),
  },
  (t) => [
    index('audit_logs_org_id_idx').on(t.orgId),
    index('audit_logs_actor_user_id_idx').on(t.actorUserId),
    index('audit_logs_entity_idx').on(t.entityType, t.entityId),
    index('audit_logs_created_at_idx').on(t.createdAt),
  ],
);

export const notifications = pgTable(
  'notifications',
  {
    id: pk(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    userId: uuid('user_id').references(() => users.id, {
      onDelete: 'set null',
    }),
    channel: text('channel'),
    type: text('type'),
    title: text('title'),
    body: text('body'),
    payload: jsonb('payload'),
    readAt: timestamp('read_at', { withTimezone: true }),
    sentAt: timestamp('sent_at', { withTimezone: true }),
    createdAt: createdAt(),
  },
  (t) => [
    index('notifications_org_id_idx').on(t.orgId),
    index('notifications_user_id_idx').on(t.userId),
    index('notifications_read_at_idx').on(t.readAt),
  ],
);
