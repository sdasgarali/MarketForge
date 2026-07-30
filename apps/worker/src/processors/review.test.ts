/**
 * Processor test: `review` end-to-end with mocked adapters, db, and queue.
 * Verifies the gate: pass → status='review'; fail (regen available) → enqueue
 * generate-text with attempt_reason='regeneration' + status='generating'.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest';

// --- Mocks (must be declared before importing the SUT) ---------------------

const enqueueGenerateText = vi.fn<(payload: Record<string, unknown>) => Promise<string>>(async () => 'job-1');

// A fake tenant tx that records inserts/updates and returns a stubbed content item.
interface FakeState {
  contentItem: Record<string, unknown>;
  reviewInserts: unknown[];
  statusUpdates: { status: string; patch: Record<string, unknown> }[];
}
let fake: FakeState;

vi.mock('@marketforge/queue', () => ({
  enqueueGenerateText: (payload: Record<string, unknown>) => enqueueGenerateText(payload),
}));

// Mock the adapters LLM so reviewer stages return a controllable score.
let stageScore = 95;
vi.mock('@marketforge/adapters', () => ({
  adapters: {
    llm: {
      generateText: vi.fn(async () => ({
        text: JSON.stringify({ score: stageScore, passed: stageScore >= 90, findings: 'ok' }),
        usage: { tokens_in: 10, tokens_out: 5, cost_usd: 0.001, latency_ms: 12, model: 'mock-opus', provider: 'mock' },
      })),
    },
  },
}));

// Mock @marketforge/db: withTenant just runs the callback with a fake tx; the
// table symbols are opaque tokens; getContentItem/etc. read from `fake`.
vi.mock('@marketforge/db', () => {
  const makeTx = () => ({
    select: () => ({
      from: () => ({
        where: () => ({ limit: async () => [fake.contentItem] }),
      }),
    }),
    insert: () => ({ values: async (v: unknown) => { fake.reviewInserts.push(v); } }),
    update: () => ({ set: (s: Record<string, unknown>) => ({ where: async () => {
      fake.statusUpdates.push({ status: String(s.status), patch: s });
    } }) }),
  });
  return {
    db: {},
    withTenant: async (_db: unknown, _org: string, cb: (tx: unknown) => Promise<unknown>) => cb(makeTx()),
    reviewResults: {},
    brands: {},
    contentItems: {},
    auditLogs: {},
    promptTemplates: {},
    assets: {},
  };
});

// Mock the content + brand + audit helpers so we bypass drizzle query building.
vi.mock('../lib/content.js', () => ({
  getContentItem: async () => fake.contentItem,
  setContentStatus: async (_tx: unknown, _id: string, status: string, patch: Record<string, unknown> = {}) => {
    fake.statusUpdates.push({ status, patch });
  },
}));
vi.mock('../lib/brand.js', () => ({
  getBrand: async () => ({ id: 'brand-1', companyName: 'Acme', brandVoice: 'bold' }),
  brandContextLine: () => 'Company: Acme',
}));
vi.mock('../lib/audit.js', () => ({ writeAudit: async () => {} }));

// Import the SUT AFTER mocks.
const { reviewProcessor } = await import('./review.js');

const ORG = '22222222-2222-2222-2222-222222222222';
const CID = '33333333-3333-3333-3333-333333333333';

function makeJob(overrides: Record<string, unknown> = {}) {
  return {
    id: 'job-1',
    attemptsMade: 0,
    opts: { attempts: 5 },
    data: {
      org_id: ORG,
      brand_id: 'brand-1',
      content_item_id: CID,
      threshold: 90,
      attempt_reason: 'initial',
      ...overrides,
    },
  } as never;
}

beforeEach(() => {
  enqueueGenerateText.mockClear();
  fake = {
    contentItem: {
      id: CID,
      brandId: 'brand-1',
      platform: 'x',
      contentType: 'post',
      language: 'en',
      title: 'T',
      body: 'B',
      caption: 'C',
      hashtags: ['#a'],
      metadata: {},
    },
    reviewInserts: [],
    statusUpdates: [],
  };
});

describe('review processor', () => {
  it('passes review → sets status=review, does NOT enqueue regeneration', async () => {
    stageScore = 96;
    const res = (await reviewProcessor(makeJob())) as { passed: boolean };
    expect(res.passed).toBe(true);
    expect(enqueueGenerateText).not.toHaveBeenCalled();
    expect(fake.statusUpdates.some((u) => u.status === 'review')).toBe(true);
    // One review_results insert per default stage (6).
    expect(fake.reviewInserts.length).toBe(6);
  });

  it('fails review with regen available → status=generating + enqueue regeneration', async () => {
    stageScore = 40;
    const res = (await reviewProcessor(makeJob())) as { passed: boolean };
    expect(res.passed).toBe(false);
    expect(enqueueGenerateText).toHaveBeenCalledTimes(1);
    const arg = enqueueGenerateText.mock.calls[0]![0] as { attempt_reason: string; content_item_id: string };
    expect(arg.attempt_reason).toBe('regeneration');
    expect(arg.content_item_id).toBe(CID);
    expect(fake.statusUpdates.some((u) => u.status === 'generating')).toBe(true);
  });

  it('fails review but regen exhausted → status=review, no regeneration', async () => {
    stageScore = 40;
    fake.contentItem.metadata = { regen_count: 2 };
    const res = (await reviewProcessor(makeJob())) as { passed: boolean };
    expect(res.passed).toBe(false);
    expect(enqueueGenerateText).not.toHaveBeenCalled();
    expect(fake.statusUpdates.some((u) => u.status === 'review')).toBe(true);
  });
});
