/**
 * @marketforge/db — Drizzle schema + tenant-scoped client (ADR-001).
 *
 * Public surface:
 *  - the full schema (all tables), re-exported;
 *  - {@link createDb}, {@link withTenant}, {@link TENANT_SETTING}, and the
 *    lazy default {@link db};
 *  - inferred row types for the main tables.
 */
export * from './schema/index.js';
export {
  createDb,
  withTenant,
  TENANT_SETTING,
  db,
} from './client.js';
export type { Database, Db, Schema, TenantTx } from './client.js';

import type {
  organizations,
  users,
  orgMemberships,
} from './schema/tenancy.js';
import type { brandKnowledge, brands, contacts, socialAccounts } from './schema/brands.js';
import type {
  campaigns,
  contentItems,
  assets,
  researchReports,
  reviewResults,
} from './schema/content.js';
import type {
  publishJobs,
  analytics,
  promptTemplates,
  aiAgentConfigs,
  apiCredentials,
  auditLogs,
  notifications,
} from './schema/ops.js';

// --- Inferred SELECT row types --------------------------------------------
export type OrganizationRow = typeof organizations.$inferSelect;
export type UserRow = typeof users.$inferSelect;
export type OrgMembershipRow = typeof orgMemberships.$inferSelect;
export type BrandRow = typeof brands.$inferSelect;
export type SocialAccountRow = typeof socialAccounts.$inferSelect;
export type CampaignRow = typeof campaigns.$inferSelect;
export type ContentItemRow = typeof contentItems.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;
export type ResearchReportRow = typeof researchReports.$inferSelect;
export type ReviewResultRow = typeof reviewResults.$inferSelect;
export type PublishJobRow = typeof publishJobs.$inferSelect;
export type AnalyticsRow = typeof analytics.$inferSelect;
export type PromptTemplateRow = typeof promptTemplates.$inferSelect;
export type AiAgentConfigRow = typeof aiAgentConfigs.$inferSelect;
export type ApiCredentialRow = typeof apiCredentials.$inferSelect;
export type AuditLogRow = typeof auditLogs.$inferSelect;
export type NotificationRow = typeof notifications.$inferSelect;

// --- Inferred INSERT row types --------------------------------------------
export type OrganizationInsert = typeof organizations.$inferInsert;
export type UserInsert = typeof users.$inferInsert;
export type OrgMembershipInsert = typeof orgMemberships.$inferInsert;
export type BrandInsert = typeof brands.$inferInsert;
export type SocialAccountInsert = typeof socialAccounts.$inferInsert;
export type BrandKnowledgeRow = typeof brandKnowledge.$inferSelect;
export type BrandKnowledgeInsert = typeof brandKnowledge.$inferInsert;
export type ContactRow = typeof contacts.$inferSelect;
export type ContactInsert = typeof contacts.$inferInsert;
export type CampaignInsert = typeof campaigns.$inferInsert;
export type ContentItemInsert = typeof contentItems.$inferInsert;
export type AssetInsert = typeof assets.$inferInsert;
export type ResearchReportInsert = typeof researchReports.$inferInsert;
export type ReviewResultInsert = typeof reviewResults.$inferInsert;
export type PublishJobInsert = typeof publishJobs.$inferInsert;
export type AnalyticsInsert = typeof analytics.$inferInsert;
export type PromptTemplateInsert = typeof promptTemplates.$inferInsert;
export type AiAgentConfigInsert = typeof aiAgentConfigs.$inferInsert;
export type ApiCredentialInsert = typeof apiCredentials.$inferInsert;
export type AuditLogInsert = typeof auditLogs.$inferInsert;
export type NotificationInsert = typeof notifications.$inferInsert;
