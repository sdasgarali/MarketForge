// STUB — replace with real impl in src/impl/<name>.ts (owned by another agent).
//
// Real backend: Ayrshare aggregator, one profileKey per brand (ADR-006). No
// MCP — Ayrshare REST API with AYRSHARE_API_KEY + per-brand profileKey header.
//
// This stub reports a synthetic "published" result per platform and returns an
// empty analytics snapshot instead of throwing, so downstream dev flows run.

import type { Platform } from '@marketforge/contracts';
import type {
  PublisherAdapter,
  PublishPost,
  PublishMedia,
} from '../interfaces/publisher.js';
import type { PublishResult, AnalyticsSnapshot } from '../interfaces/types.js';

export class StubPublisherAdapter implements PublisherAdapter {
  readonly name = 'stub-publisher';

  async publish(
    _post: PublishPost,
    platforms: Platform[],
    _media: PublishMedia[],
    brandProfileKey: string,
  ): Promise<PublishResult[]> {
    // TODO(impl): POST to Ayrshare /post with brandProfileKey; map response.
    return platforms.map((platform) => ({
      platform,
      status: 'published' as const,
      externalPostId: `stub-${brandProfileKey}-${platform}-${Date.now()}`,
      postUrl: `stub://post/${platform}`,
    }));
  }

  async fetchAnalytics(
    externalPostId: string,
    platform: Platform,
    _brandProfileKey: string,
  ): Promise<AnalyticsSnapshot> {
    // TODO(impl): GET Ayrshare /analytics/post; map metrics into snapshot.
    return {
      platform,
      externalPostId,
      views: 0,
      likes: 0,
      comments: 0,
      shares: 0,
      impressions: 0,
      capturedAt: new Date().toISOString(),
      raw: { stub: true },
    };
  }
}
