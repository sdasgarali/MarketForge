/**
 * Audit-log helper (ADR-009). Writes an append-only row to `audit_logs` on every
 * mutation. All writes go through `withTenant` so RLS scopes the row to the
 * caller's org — never a raw db insert.
 */
import type { Request } from 'express';
import { auditLogs, db, withTenant } from '@marketforge/db';
import type { TenantTx } from '@marketforge/db';
import { createLogger } from '@marketforge/logger';
import type { TenantContext } from '@marketforge/auth';

const log = createLogger({ service: 'api', workflow: 'audit' });

export interface AuditEntry {
  action: string;
  entityType: string;
  entityId?: string;
  before?: unknown;
  after?: unknown;
}

/** Extract caller IP + UA for the audit trail (best-effort, never throws). */
function requestMeta(req?: Request): { ip?: string; userAgent?: string } {
  if (!req) return {};
  const ua = req.headers['user-agent'];
  return {
    ip: req.ip,
    userAgent: Array.isArray(ua) ? ua[0] : ua,
  };
}

/**
 * Write an audit row for a mutation. Failures are logged but never bubble up to
 * fail the user's request (audit is best-effort observability, not a gate).
 *
 * Pass an existing `tx` to record the audit atomically inside the caller's
 * transaction; otherwise a dedicated withTenant transaction is opened.
 */
export async function writeAudit(
  ctx: TenantContext,
  entry: AuditEntry,
  req?: Request,
  tx?: TenantTx,
): Promise<void> {
  const meta = requestMeta(req);
  const row = {
    orgId: ctx.orgId,
    actorUserId: ctx.user.id,
    actorType: 'user',
    action: entry.action,
    entityType: entry.entityType,
    entityId: entry.entityId ?? null,
    before: (entry.before ?? null) as never,
    after: (entry.after ?? null) as never,
    ip: meta.ip ?? null,
    userAgent: meta.userAgent ?? null,
  };

  try {
    if (tx) {
      await tx.insert(auditLogs).values(row);
      return;
    }
    await withTenant(db, ctx.orgId, async (t) => {
      await t.insert(auditLogs).values(row);
    });
  } catch (err) {
    log.error(
      { err, org_id: ctx.orgId, action: entry.action, entity: entry.entityType },
      'failed to write audit log',
    );
  }
}
