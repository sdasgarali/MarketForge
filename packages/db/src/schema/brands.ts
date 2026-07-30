import { sql } from 'drizzle-orm';
import {
  check,
  index,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from 'drizzle-orm/pg-core';
import { createdAt, orgId, pk, updatedAt } from './_shared.js';
import { organizations } from './tenancy.js';

/**
 * Brand + connected social accounts. Both are tenant-scoped (org_id NOT NULL).
 */

export const brands = pgTable(
  'brands',
  {
    id: pk(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    companyName: text('company_name').notNull(),
    website: text('website'),
    industry: text('industry'),
    products: jsonb('products'),
    services: jsonb('services'),
    mission: text('mission'),
    vision: text('vision'),
    targetAudience: jsonb('target_audience'),
    competitors: jsonb('competitors'),
    logoAssetId: uuid('logo_asset_id'),
    brandColors: jsonb('brand_colors'),
    fonts: jsonb('fonts'),
    icons: jsonb('icons'),
    brandVoice: text('brand_voice'),
    writingStyle: text('writing_style'),
    preferredCta: text('preferred_cta'),
    negativePrompt: text('negative_prompt'),
    imageStyle: text('image_style'),
    videoStyle: text('video_style'),
    approvedCharacters: jsonb('approved_characters'),
    timezone: text('timezone'),
    languages: text('languages').array(),
    driveFolderId: text('drive_folder_id'),
    publishingSchedule: jsonb('publishing_schedule'),
    approvalSettings: jsonb('approval_settings'),
    knowledgeBase: jsonb('knowledge_base'),
    status: text('status').notNull().default('active'),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [index('brands_org_id_idx').on(t.orgId)],
);

export const socialAccounts = pgTable(
  'social_accounts',
  {
    id: pk(),
    orgId: orgId().references(() => organizations.id, { onDelete: 'cascade' }),
    brandId: uuid('brand_id')
      .notNull()
      .references(() => brands.id, { onDelete: 'cascade' }),
    platform: text('platform').notNull(),
    handle: text('handle'),
    externalAccountId: text('external_account_id'),
    credentialsRef: uuid('credentials_ref'),
    profileKey: text('profile_key'),
    connectionStatus: text('connection_status').notNull().default('disconnected'),
    connectedAt: timestamp('connected_at', { withTimezone: true }),
    expiresAt: timestamp('expires_at', { withTimezone: true }),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    check(
      'social_accounts_platform_chk',
      sql`${t.platform} IN ('youtube','instagram','facebook','linkedin','x','tiktok')`,
    ),
    index('social_accounts_org_id_idx').on(t.orgId),
    index('social_accounts_brand_id_idx').on(t.brandId),
  ],
);
