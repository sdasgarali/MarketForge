/**
 * Tenant-scoped helpers for the `content_items` / `assets` state machine. Every
 * function takes an open {@link TenantTx} so it participates in the caller's
 * withTenant transaction (RLS-scoped).
 */
import { and, eq } from 'drizzle-orm';
import { assets, contentItems, type TenantTx } from '@marketforge/db';
import type { ContentStatus } from '@marketforge/contracts';

export type ContentItemRow = typeof contentItems.$inferSelect;
export type AssetRow = typeof assets.$inferSelect;

/** Load a content item within the tenant transaction, or undefined. */
export async function getContentItem(tx: TenantTx, id: string): Promise<ContentItemRow | undefined> {
  const rows = await tx.select().from(contentItems).where(eq(contentItems.id, id)).limit(1);
  return rows[0];
}

/** Update a content item's status (+ optional patch) and bump updated_at. */
export async function setContentStatus(
  tx: TenantTx,
  id: string,
  status: ContentStatus,
  patch: Partial<typeof contentItems.$inferInsert> = {},
): Promise<void> {
  await tx
    .update(contentItems)
    .set({ status, updatedAt: new Date(), ...patch })
    .where(eq(contentItems.id, id));
}

/** Count ready assets of a given kind for a content item. */
export async function countReadyAssets(
  tx: TenantTx,
  contentItemId: string,
  kind: string,
): Promise<number> {
  const rows = await tx
    .select({ id: assets.id })
    .from(assets)
    .where(
      and(
        eq(assets.contentItemId, contentItemId),
        eq(assets.kind, kind),
        eq(assets.status, 'ready'),
      ),
    );
  return rows.length;
}

/**
 * Fan-in readiness gate for the review stage: a content item is ready to review
 * when its copy exists (body or caption present) AND at least one image asset
 * is ready. Image generation and text generation run in parallel; whichever
 * finishes last triggers review.
 */
export async function isReadyForReview(tx: TenantTx, item: ContentItemRow): Promise<boolean> {
  const hasCopy = Boolean(item.body?.trim() || item.caption?.trim());
  if (!hasCopy) return false;
  const readyImages = await countReadyAssets(tx, item.id, 'image');
  return readyImages > 0;
}
