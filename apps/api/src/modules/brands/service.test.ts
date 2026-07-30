/**
 * Brands service test. Mocks @marketforge/db so we assert the service's behavior
 * (tenant-scoping via withTenant, mapping, not-found handling) without a real DB.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mock the db package BEFORE importing the service under test. -----------
const selectRows = vi.fn();
const insertReturning = vi.fn();

// A chainable query-builder stub. Each terminal method resolves to `selectRows()`.
function makeTx() {
  const chain: Record<string, unknown> = {};
  const self = () => chain;
  Object.assign(chain, {
    select: vi.fn(() => chain),
    from: vi.fn(() => chain),
    where: vi.fn(() => chain),
    orderBy: vi.fn(() => chain),
    limit: vi.fn(() => chain),
    offset: vi.fn(async () => selectRows()),
    insert: vi.fn(() => chain),
    values: vi.fn(() => chain),
    returning: vi.fn(async () => insertReturning()),
  });
  // `limit` is terminal for get() (no offset); make it await-able too.
  chain.limit = vi.fn(() => ({
    then: (r: (v: unknown) => unknown) => Promise.resolve(selectRows()).then(r),
    offset: vi.fn(async () => selectRows()),
  }));
  return self();
}

vi.mock('@marketforge/db', () => ({
  db: {},
  brands: {
    id: 'id',
    createdAt: 'createdAt',
  },
  withTenant: vi.fn(async (_db: unknown, _orgId: string, cb: (tx: unknown) => Promise<unknown>) =>
    cb(makeTx()),
  ),
}));

// drizzle-orm helpers are pure — stub to no-ops so imports resolve.
vi.mock('drizzle-orm', () => ({
  and: (...a: unknown[]) => a,
  desc: (c: unknown) => c,
  eq: (a: unknown, b: unknown) => [a, b],
  sql: Object.assign(() => 'sql', { raw: () => 'sql' }),
}));

const { brandsService } = await import('./service.js');
const { withTenant } = await import('@marketforge/db');

const ORG = '00000000-0000-0000-0000-000000000001';

const dbRow = {
  id: 'b1',
  orgId: ORG,
  companyName: 'Acme',
  status: 'active',
  products: [],
  services: [],
  competitors: [],
  fonts: [],
  languages: ['en'],
  approvedCharacters: [],
  timezone: 'UTC',
  createdAt: new Date('2026-01-01T00:00:00Z'),
  updatedAt: null,
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe('brandsService', () => {
  it('get() scopes by tenant via withTenant and maps the row to a DTO', async () => {
    selectRows.mockResolvedValue([dbRow]);
    const dto = await brandsService.get(ORG, 'b1');
    expect(withTenant).toHaveBeenCalledWith(expect.anything(), ORG, expect.any(Function));
    expect(dto).toMatchObject({ id: 'b1', org_id: ORG, company_name: 'Acme', status: 'active' });
    expect(dto.created_at).toBe('2026-01-01T00:00:00.000Z');
  });

  it('get() throws NotFound when no row is returned', async () => {
    selectRows.mockResolvedValue([]);
    await expect(brandsService.get(ORG, 'missing')).rejects.toThrow(/not found/i);
  });

  it('create() inserts and returns the mapped brand', async () => {
    insertReturning.mockResolvedValue([dbRow]);
    const dto = await brandsService.create(ORG, { company_name: 'Acme' });
    expect(withTenant).toHaveBeenCalledWith(expect.anything(), ORG, expect.any(Function));
    expect(dto).toMatchObject({ id: 'b1', company_name: 'Acme' });
  });
});
