/**
 * Mock dataset — a coherent, realistic seed so every page renders with no API.
 * Used as a fallback when the API is unreachable (dev affordance) and by the
 * initial `/me` bootstrap under DEV_AUTH_BYPASS.
 */
import type {
  AnalyticsSummary,
  ApprovalItem,
  Brand,
  Campaign,
  CompositeReview,
  ContentItem,
  DashboardSummary,
  MeResponse,
  Notification,
  Platform,
  PromptTemplate,
  ReviewResult,
  ReviewStage,
  SocialAccount,
} from '../types';
import { REVIEW_STAGES } from '../types';

const now = Date.now();
const iso = (offsetMs: number) => new Date(now + offsetMs).toISOString();
const HOUR = 3_600_000;
const DAY = 24 * HOUR;

export const MOCK_ORG_ID = '11111111-1111-1111-1111-111111111111';
export const MOCK_ORG_ID_2 = '22222222-2222-2222-2222-222222222222';

export const mockMe: MeResponse = {
  user: {
    id: 'aaaaaaaa-0000-0000-0000-000000000001',
    email: 'dev@marketforge.local',
    full_name: 'Dev Operator',
    avatar_url: undefined,
    created_at: iso(-90 * DAY),
  },
  org: {
    id: MOCK_ORG_ID,
    name: 'Neuraforz Studio',
    slug: 'neuraforz-studio',
    plan: 'pro',
    status: 'active',
    created_at: iso(-120 * DAY),
  },
  role: 'admin',
  memberships: [
    {
      org: {
        id: MOCK_ORG_ID,
        name: 'Neuraforz Studio',
        slug: 'neuraforz-studio',
        plan: 'pro',
        status: 'active',
        created_at: iso(-120 * DAY),
      },
      role: 'admin',
    },
    {
      org: {
        id: MOCK_ORG_ID_2,
        name: 'Exzelon Labs',
        slug: 'exzelon-labs',
        plan: 'free',
        status: 'active',
        created_at: iso(-40 * DAY),
      },
      role: 'manager',
    },
  ],
};

export const mockBrands: Brand[] = [
  {
    id: 'b0000000-0000-0000-0000-000000000001',
    org_id: MOCK_ORG_ID,
    created_at: iso(-80 * DAY),
    updated_at: iso(-2 * DAY),
    company_name: 'Aurora Skincare',
    website: 'https://auroraskincare.com',
    industry: 'Beauty & Personal Care',
    products: ['Vitamin C Serum', 'Night Repair Cream', 'SPF 50 Fluid'],
    services: [],
    mission: 'Clean, science-backed skincare for every skin tone.',
    vision: 'A world where great skincare is simple and inclusive.',
    competitors: ['The Ordinary', 'CeraVe', 'Paula’s Choice'],
    brand_colors: { primary: '#E8557A', secondary: '#2B2B33', accent: '#F5C24B' },
    fonts: ['Inter', 'Fraunces'],
    brand_voice: 'Warm, confident, dermatologist-precise. Never hypey.',
    writing_style: 'Short sentences. Concrete claims. No exclamation spam.',
    preferred_cta: 'Shop the routine',
    negative_prompt: 'no medical claims, no before/after promises, no minors',
    image_style: 'soft daylight, matte skin, pastel gradients, editorial',
    video_style: 'slow product macro, ASMR texture',
    approved_characters: [
      {
        name: 'Aria (brand model)',
        description: 'Mid-20s, warm undertone, natural glow',
        aspect_ratio: '4:5',
      },
    ],
    timezone: 'America/New_York',
    languages: ['en', 'es'],
    approval_settings: { mode: 'manual', min_score: 90, trust_tier: 'reviewed' },
    status: 'active',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000002',
    org_id: MOCK_ORG_ID,
    created_at: iso(-55 * DAY),
    updated_at: iso(-5 * DAY),
    company_name: 'Northwind Coffee',
    website: 'https://northwind.coffee',
    industry: 'Food & Beverage',
    products: ['Single-origin Ethiopia', 'Cold Brew Concentrate'],
    services: ['Subscription'],
    competitors: ['Blue Bottle', 'Stumptown'],
    brand_colors: { primary: '#6F4E37', secondary: '#0E7C66', accent: '#E4B363' },
    fonts: ['Inter'],
    brand_voice: 'Craft-forward, cozy, a little witty.',
    preferred_cta: 'Brew better',
    image_style: 'moody café light, steam, wood + ceramic',
    approved_characters: [],
    timezone: 'America/Los_Angeles',
    languages: ['en'],
    approval_settings: { mode: 'auto', min_score: 92, trust_tier: 'trusted' },
    status: 'active',
  },
  {
    id: 'b0000000-0000-0000-0000-000000000003',
    org_id: MOCK_ORG_ID,
    created_at: iso(-12 * DAY),
    company_name: 'Volt Fitness',
    website: 'https://voltfitness.app',
    industry: 'Health & Fitness',
    products: ['AI Workout App'],
    services: [],
    competitors: ['Whoop', 'Strava'],
    brand_colors: { primary: '#7C3AED', secondary: '#111827', accent: '#22D3EE' },
    fonts: ['Inter'],
    brand_voice: 'High-energy, motivating, no-nonsense.',
    preferred_cta: 'Start your streak',
    image_style: 'high-contrast gym, neon rim light, sweat detail',
    approved_characters: [],
    timezone: 'Europe/London',
    languages: ['en'],
    approval_settings: { mode: 'manual', min_score: 88, trust_tier: 'new' },
    status: 'active',
  },
];

export const mockSocialAccounts: SocialAccount[] = [
  {
    id: 's0000000-0000-0000-0000-000000000001',
    org_id: MOCK_ORG_ID,
    created_at: iso(-70 * DAY),
    brand_id: mockBrands[0]!.id,
    platform: 'instagram',
    handle: '@auroraskincare',
    connection_status: 'connected',
    connected_at: iso(-70 * DAY),
  },
  {
    id: 's0000000-0000-0000-0000-000000000002',
    org_id: MOCK_ORG_ID,
    created_at: iso(-70 * DAY),
    brand_id: mockBrands[0]!.id,
    platform: 'x',
    handle: '@aurora_skin',
    connection_status: 'connected',
    connected_at: iso(-70 * DAY),
  },
  {
    id: 's0000000-0000-0000-0000-000000000003',
    org_id: MOCK_ORG_ID,
    created_at: iso(-40 * DAY),
    brand_id: mockBrands[1]!.id,
    platform: 'instagram',
    handle: '@northwindcoffee',
    connection_status: 'expired',
    connected_at: iso(-40 * DAY),
    expires_at: iso(-1 * DAY),
  },
];

export const mockCampaigns: Campaign[] = [
  {
    id: 'c0000000-0000-0000-0000-000000000001',
    org_id: MOCK_ORG_ID,
    created_at: iso(-30 * DAY),
    updated_at: iso(-1 * DAY),
    brand_id: mockBrands[0]!.id,
    name: 'Summer Glow Launch',
    campaign_type: 'launch',
    platform: 'instagram',
    topic: 'SPF 50 Fluid launch + UGC',
    priority: 8,
    language: 'en',
    timezone: 'America/New_York',
    run_at: iso(-2 * DAY),
    status: 'running',
    retry_count: 0,
    approval_required: true,
    auto_mode: false,
  },
  {
    id: 'c0000000-0000-0000-0000-000000000002',
    org_id: MOCK_ORG_ID,
    created_at: iso(-20 * DAY),
    brand_id: mockBrands[1]!.id,
    name: 'Weekly Bean Drop',
    campaign_type: 'weekly',
    platform: 'x',
    topic: 'Single-origin spotlight',
    priority: 5,
    language: 'en',
    timezone: 'America/Los_Angeles',
    status: 'running',
    retry_count: 0,
    approval_required: false,
    auto_mode: true,
  },
  {
    id: 'c0000000-0000-0000-0000-000000000003',
    org_id: MOCK_ORG_ID,
    created_at: iso(-6 * DAY),
    brand_id: mockBrands[2]!.id,
    name: 'New Year Streak Challenge',
    campaign_type: 'one_time',
    platform: 'instagram',
    topic: '30-day streak challenge',
    priority: 6,
    language: 'en',
    timezone: 'Europe/London',
    status: 'draft',
    retry_count: 0,
    approval_required: true,
    auto_mode: false,
  },
];

const captions = [
  'Your 3-step glow routine, decoded. Vitamin C in the AM, repair at night, SPF always. ☀️',
  'Cold brew season is officially open. Smooth, low-acid, ridiculously easy. ☕',
  'Day 1 of your streak starts now. No excuses, just reps. 💪',
  'The serum that actually earned its hype. Here’s the science.',
  'Single-origin Ethiopia is back — bright, floral, and gone fast.',
  'Small habit, big results. Screenshot this for your Monday.',
];
const platformsCycle: Platform[] = ['instagram', 'x', 'instagram', 'x'];
const statuses: ContentItem['status'][] = [
  'review',
  'approved',
  'scheduled',
  'published',
  'generating',
  'review',
  'needs_media',
  'published',
  'draft',
  'scheduled',
];

export const mockContentItems: ContentItem[] = Array.from({ length: 22 }).map(
  (_, i) => {
    const brand = mockBrands[i % mockBrands.length]!;
    const status = statuses[i % statuses.length]!;
    const scheduledFuture = status === 'scheduled' || status === 'approved';
    return {
      id: `d0000000-0000-0000-0000-0000000000${(i + 10).toString().padStart(2, '0')}`,
      org_id: MOCK_ORG_ID,
      created_at: iso(-(i + 1) * 6 * HOUR),
      updated_at: iso(-(i + 1) * 3 * HOUR),
      brand_id: brand.id,
      campaign_id: mockCampaigns[i % mockCampaigns.length]!.id,
      platform: platformsCycle[i % platformsCycle.length]!,
      content_type: i % 4 === 0 ? 'carousel' : 'post',
      language: 'en',
      title: `${brand.company_name} — post ${i + 1}`,
      body: captions[i % captions.length],
      caption: captions[i % captions.length],
      hashtags:
        i % 2 === 0
          ? ['#skincare', '#glowup', '#cleanbeauty']
          : ['#coffee', '#coldbrew', '#singleorigin'],
      status,
      quality_score: status === 'generating' ? undefined : 78 + ((i * 7) % 22),
      version: 1 + (i % 3),
      generated_at: iso(-(i + 1) * 5 * HOUR),
      scheduled_at: scheduledFuture
        ? iso((i % 6) * 8 * HOUR + 4 * HOUR)
        : status === 'published'
          ? iso(-(i + 1) * DAY)
          : undefined,
      image_url:
        status === 'needs_media'
          ? undefined
          : `https://picsum.photos/seed/mf${i}/640/640`,
    };
  },
);

function buildComposite(seed: number, itemId: string): {
  composite: CompositeReview;
  reviews: ReviewResult[];
} {
  const stage_scores: Partial<Record<ReviewStage, number>> = {};
  const reviews: ReviewResult[] = [];
  const failed: ReviewStage[] = [];
  REVIEW_STAGES.forEach((stage, idx) => {
    const score = Math.max(
      55,
      Math.min(99, 82 + ((seed * 13 + idx * 7) % 20) - (idx === 3 ? 12 : 0)),
    );
    stage_scores[stage] = score;
    const passed = score >= 80;
    if (!passed) failed.push(stage);
    reviews.push({
      id: `r-${itemId}-${stage}`,
      content_item_id: itemId,
      stage,
      agent: `${stage}_checker`,
      score,
      passed,
      model: 'claude-opus-4-8',
      created_at: iso(-seed * HOUR),
      findings: passed
        ? null
        : { note: `Minor ${stage} issue flagged; consider a quick revision.` },
    });
  });
  const vals = Object.values(stage_scores) as number[];
  const composite_score = Math.round(
    vals.reduce((a, b) => a + b, 0) / vals.length,
  );
  return {
    composite: {
      content_item_id: itemId,
      stage_scores,
      composite_score,
      passed: composite_score >= 90 && failed.length === 0,
      threshold: 90,
      failed_stages: failed,
    },
    reviews,
  };
}

export const mockApprovals: ApprovalItem[] = mockContentItems
  .filter((c) => c.status === 'review')
  .map((item, i) => {
    const brand = mockBrands.find((b) => b.id === item.brand_id)!;
    const { composite, reviews } = buildComposite(i + 3, item.id);
    return {
      content_item: item,
      composite,
      reviews,
      brand_name: brand.company_name,
    };
  });

export function mockCompositeFor(itemId: string): {
  composite: CompositeReview;
  reviews: ReviewResult[];
} {
  return buildComposite(itemId.length, itemId);
}

const platforms: Platform[] = ['instagram', 'x'];
export const mockAnalytics: AnalyticsSummary = {
  by_platform: platforms.map((platform, i) => ({
    platform,
    impressions: 120_000 - i * 34_000,
    reach: 88_000 - i * 22_000,
    likes: 9_400 - i * 2_100,
    comments: 720 - i * 180,
    shares: 410 - i * 90,
    clicks: 3_200 - i * 900,
    engagement_rate: 0.061 - i * 0.014,
    posts: 48 - i * 12,
  })),
  timeseries: Array.from({ length: 30 }).map((_, d) => ({
    date: new Date(now - (29 - d) * DAY).toISOString().slice(0, 10),
    impressions: 3_000 + Math.round(1_800 * Math.sin(d / 3) + d * 90),
    engagement: 220 + Math.round(140 * Math.sin(d / 2.5) + d * 6),
    clicks: 90 + Math.round(60 * Math.cos(d / 4) + d * 3),
  })),
  totals: {
    impressions: 208_000,
    engagement: 12_100,
    followers_delta: 3_450,
    posts: 60,
  },
};

export const mockNotifications: Notification[] = [
  {
    id: 'n1',
    org_id: MOCK_ORG_ID,
    channel: 'dashboard',
    type: 'approval',
    title: '3 items awaiting your approval',
    body: 'Aurora Skincare — Summer Glow Launch has items above threshold.',
    created_at: iso(-2 * HOUR),
  },
  {
    id: 'n2',
    org_id: MOCK_ORG_ID,
    channel: 'dashboard',
    type: 'success',
    title: 'Post published to Instagram',
    body: 'Northwind Coffee — “Cold brew season is officially open.”',
    read_at: iso(-3 * HOUR),
    created_at: iso(-4 * HOUR),
  },
  {
    id: 'n3',
    org_id: MOCK_ORG_ID,
    channel: 'dashboard',
    type: 'warning',
    title: 'Instagram connection expired',
    body: 'Northwind Coffee needs to reconnect its Instagram account.',
    created_at: iso(-1 * DAY),
  },
  {
    id: 'n4',
    org_id: MOCK_ORG_ID,
    channel: 'dashboard',
    type: 'failure',
    title: 'Generation retry failed',
    body: 'Volt Fitness — image generation exceeded retries; needs media.',
    created_at: iso(-1.5 * DAY),
  },
  {
    id: 'n5',
    org_id: MOCK_ORG_ID,
    channel: 'dashboard',
    type: 'queue_status',
    title: 'Campaign started',
    body: 'Summer Glow Launch enqueued 8 content jobs.',
    read_at: iso(-2 * DAY),
    created_at: iso(-2 * DAY),
  },
];

export const mockPromptTemplates: PromptTemplate[] = [
  {
    id: 'p1',
    org_id: MOCK_ORG_ID,
    name: 'Instagram Caption — Product',
    agent_type: 'copywriter',
    version: 3,
    body: 'Write a {{tone}} Instagram caption for {{product}} targeting {{audience}}. Include {{cta}} and 3 hashtags.',
    is_active: true,
    created_at: iso(-20 * DAY),
  },
  {
    id: 'p2',
    org_id: MOCK_ORG_ID,
    name: 'Brand Compliance Reviewer',
    agent_type: 'brand_compliance',
    version: 5,
    body: 'Score the content 0–100 for adherence to {{brand_voice}}. Flag any {{negative_prompt}} violations.',
    is_active: true,
    created_at: iso(-40 * DAY),
  },
  {
    id: 'p3',
    org_id: null,
    name: 'Hashtag Generator (global)',
    agent_type: 'hashtag_generator',
    version: 1,
    body: 'Generate 5 high-reach, low-spam hashtags for {{topic}} on {{platform}}.',
    is_active: true,
    created_at: iso(-60 * DAY),
  },
];

export const mockDashboard: DashboardSummary = {
  content_by_status: {
    draft: 4,
    generating: 3,
    review: mockApprovals.length,
    approved: 5,
    scheduled: 7,
    published: 31,
    needs_media: 2,
    failed: 1,
  },
  upcoming_scheduled: mockContentItems
    .filter((c) => c.status === 'scheduled')
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      title: c.title ?? 'Untitled',
      platform: c.platform,
      brand_name:
        mockBrands.find((b) => b.id === c.brand_id)?.company_name ?? 'Brand',
      scheduled_at: c.scheduled_at ?? iso(6 * HOUR),
    })),
  recent_publishes: mockContentItems
    .filter((c) => c.status === 'published')
    .slice(0, 5)
    .map((c) => ({
      id: c.id,
      title: c.title ?? 'Untitled',
      platform: c.platform,
      brand_name:
        mockBrands.find((b) => b.id === c.brand_id)?.company_name ?? 'Brand',
      published_at: c.scheduled_at ?? iso(-1 * DAY),
      post_url: 'https://instagram.com/p/mock',
    })),
  spend_usd_30d: 312.48,
  spend_series: Array.from({ length: 30 }).map((_, d) => ({
    date: new Date(now - (29 - d) * DAY).toISOString().slice(0, 10),
    usd: 6 + Math.round(Math.abs(Math.sin(d / 4)) * 9 * 100) / 100,
  })),
  activity: mockNotifications.map((n) => ({
    id: n.id,
    type: n.type,
    title: n.title,
    body: n.body,
    created_at: n.created_at,
  })),
  counts: {
    brands: mockBrands.length,
    active_campaigns: mockCampaigns.filter((c) => c.status === 'running').length,
    pending_approvals: mockApprovals.length,
    published_30d: 31,
  },
};
