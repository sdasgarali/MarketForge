/**
 * Append-only audit trail writer. Every terminal failure, publish, approval
 * transition, and regeneration decision writes an audit row (ADR-009). Always
 * runs inside the tenant transaction so RLS scopes the row.
 */
import { auditLogs, type TenantTx } from '@marketforge/db';
import type { Json } from '@marketforge/contracts';

export interface AuditInput {
  action: string;
  entityType?: string;
  entityId?: string;
  before?: Json;
  after?: Json;
  actorType?: string;
}

/**
 * Insert an audit row within an existing tenant transaction. `org_id` is set
 * explicitly (RLS also enforces it) so the row is attributable.
 */
export async function writeAudit(tx: TenantTx, orgId: string, input: AuditInput): Promise<void> {
  await tx.insert(auditLogs).values({
    orgId,
    actorType: input.actorType ?? 'worker',
    action: input.action,
    entityType: input.entityType ?? null,
    entityId: input.entityId ?? null,
    before: (input.before ?? null) as unknown,
    after: (input.after ?? null) as unknown,
  });
}
