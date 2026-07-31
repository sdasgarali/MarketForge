/**
 * Per-brand contacts/leads — the in-app alternative to CSV-in-Drive. AI 1 reads
 * `status='new'` rows to decide Pipeline 2 (new contacts) vs Pipeline 3. Managed
 * from the brand page or via API. Tenant-scoped.
 */
import { and, desc, eq } from 'drizzle-orm';
import { contacts, db, withTenant } from '@marketforge/db';
import { NotFoundError } from '../../http/errors.js';

function toDto(r: {
  id: string;
  brandId: string;
  name: string | null;
  handle: string | null;
  company: string | null;
  source: string;
  status: string;
  createdAt: Date;
}) {
  return {
    id: r.id,
    brand_id: r.brandId,
    name: r.name,
    handle: r.handle,
    company: r.company,
    source: r.source,
    status: r.status,
    created_at: r.createdAt.toISOString(),
  };
}

export interface ContactInput {
  name?: string;
  handle?: string;
  company?: string;
}

export const contactsService = {
  async list(orgId: string, brandId: string) {
    const rows = await withTenant(db, orgId, (tx) =>
      tx
        .select()
        .from(contacts)
        .where(eq(contacts.brandId, brandId))
        .orderBy(desc(contacts.createdAt)),
    );
    return rows.map(toDto);
  },

  async add(orgId: string, brandId: string, items: ContactInput[]) {
    const clean = items.filter((c) => c.name || c.handle || c.company);
    if (!clean.length) return { added: 0, contacts: [] };
    const rows = await withTenant(db, orgId, (tx) =>
      tx
        .insert(contacts)
        .values(
          clean.map((c) => ({
            orgId,
            brandId,
            name: c.name ?? null,
            handle: c.handle ?? null,
            company: c.company ?? null,
            source: 'manual',
            status: 'new',
          })),
        )
        .returning(),
    );
    return { added: rows.length, contacts: rows.map(toDto) };
  },

  async remove(orgId: string, brandId: string, id: string) {
    const [row] = await withTenant(db, orgId, (tx) =>
      tx
        .delete(contacts)
        .where(and(eq(contacts.id, id), eq(contacts.brandId, brandId)))
        .returning({ id: contacts.id }),
    );
    if (!row) throw new NotFoundError('Contact not found');
    return { id: row.id };
  },
};
