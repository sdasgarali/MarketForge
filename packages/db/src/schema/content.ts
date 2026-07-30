import { sql } from 'drizzle-orm';
import {
  bigint,
  boolean,
  check,
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
import { brands } from './brands.js';
import { organizations } from './tenancy.js';

/**
 * Content production tables: campaigns → content_items → assets, plus the
 * research + review artifacts that feed them. All tenant-scoped (org_id).
 */

export const campaigns = pgTable(
  'campaigns',
  {
    id: pk(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    campaignType: text('campaign_type'),
    platform: text('platform'),
    topic: text('topic'),
    priority: integer('priority').notNull().default(0),
    language: text('language'),
    timezone: text('timezone'),
    schedule: jsonb('schedule'),
    runAt: timestamp('run_at', { withTimezone: true }),
    status: text('status').notNull().default('draft'),
    retryCount: integer('retry_count').notNull().default(0),
    approvalRequired: boolean('approval_required').notNull().default(true),
    autoMode: boolean('auto_mode').notNull().default(false),
    createdBy: uuid('created_by'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('campaigns_org_id_idx').on(t.orgId),
    index('campaigns_brand_id_idx').on(t.brandId),
    index('campaigns_status_idx').on(t.status),
  ],
);

export const contentItems = pgTable(
  'content_items',
  {
    id: pk(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id').references(() => campaigns.id, {
      onDelete: 'set null',
    }),
    platform: text('platform'),
    contentType: text('content_type'),
    language: text('language'),
    title: text('title'),
    body: text('body'),
    caption: text('caption'),
    hashtags: text('hashtags').array(),
    metadata: jsonb('metadata'),
    status: text('status').notNull().default('draft'),
    qualityScore: numeric('quality_score'),
    parentId: uuid('parent_id'),
    version: integer('version').notNull().default(1),
    generatedAt: timestamp('generated_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('content_items_org_id_idx').on(t.orgId),
    index('content_items_brand_id_idx').on(t.brandId),
    index('content_items_campaign_id_idx').on(t.campaignId),
    index('content_items_status_idx').on(t.status),
    index('content_items_parent_id_idx').on(t.parentId),
  ],
);

export const assets = pgTable(
  'assets',
  {
    id: pk(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    contentItemId: uuid('content_item_id').references(() => contentItems.id, {
      onDelete: 'set null',
    }),
    kind: text('kind').notNull(),
    storageKey: text('storage_key'),
    driveFileId: text('drive_file_id'),
    mimeType: text('mime_type'),
    bytes: bigint('bytes', { mode: 'number' }),
    width: integer('width'),
    height: integer('height'),
    durationMs: integer('duration_ms'),
    checksum: text('checksum'),
    model: text('model'),
    status: text('status').notNull().default('ready'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      'assets_kind_chk',
      sql`${t.kind} IN ('image','video','gif','audio','subtitle','thumbnail','doc')`,
    ),
    index('assets_org_id_idx').on(t.orgId),
    index('assets_brand_id_idx').on(t.brandId),
    index('assets_content_item_id_idx').on(t.contentItemId),
  ],
);

export const researchReports = pgTable(
  'research_reports',
  {
    id: pk(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    campaignId: uuid('campaign_id').references(() => campaigns.id, {
      onDelete: 'set null',
    }),
    sources: jsonb('sources'),
    summary: text('summary'),
    keywords: text('keywords').array(),
    hashtags: text('hashtags').array(),
    hooks: jsonb('hooks'),
    painPoints: jsonb('pain_points'),
    searchIntent: jsonb('search_intent'),
    raw: jsonb('raw'),
    createdByAgent: text('created_by_agent'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('research_reports_org_id_idx').on(t.orgId),
    index('research_reports_brand_id_idx').on(t.brandId),
    index('research_reports_campaign_id_idx').on(t.campaignId),
  ],
);

export const reviewResults = pgTable(
  'review_results',
  {
    id: pk(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    contentItemId: uuid('content_item_id')
      .notNull()
      .references(() => contentItems.id, { onDelete: 'cascade' }),
    stage: text('stage'),
    agent: text('agent'),
    score: numeric('score'),
    passed: boolean('passed'),
    findings: jsonb('findings'),
    model: text('model'),
    tokens: integer('tokens'),
    costUsd: numeric('cost_usd'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index('review_results_org_id_idx').on(t.orgId),
    index('review_results_content_item_id_idx').on(t.contentItemId),
    index('review_results_stage_idx').on(t.stage),
  ],
);
