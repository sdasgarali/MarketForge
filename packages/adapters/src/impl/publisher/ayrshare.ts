/**
 * AyrsharePublisherAdapter — publishing + analytics via the Ayrshare REST API
 * (ADR-003). Each brand is an Ayrshare "profile"; the per-brand profile key is
 * passed via the `Profile-Key` header (Business multi-profile), never stored as
 * thousands of credentials. Platform names are mapped to Ayrshare's vocabulary
 * (x → twitter, etc.). IG/YouTube/TikTok media requirements are enforced before
 * posting so we fail fast with a clear per-platform error rather than a vendor
 * 400. The API key is sent as a Bearer token and never logged.
 *
 * Swappable: `PostizPublisherAdapter` (postiz.ts) is the future self-host path
 * behind the same interface.
 */
import type { Platform } from '@marketforge/contracts';

import { httpJson } from '../http.js';
import type {
  PublisherAdapter,
  PublishPost,
  PublishMedia,
} from '../../interfaces/publisher.js';
import type { PublishResult, AnalyticsSnapshot } from '../../interfaces/types.js';
import { AdapterError } from '../../errors.js';
import {
  toAyrsharePlatform,
  fromAyrsharePlatform,
  MEDIA_REQUIRED,
  VIDEO_REQUIRED,
} from './platform-map.js';

const API_BASE = 'https://api.ayrshare.com/api';

interface AyrsharePostResponse {
  status: string;
  id?: string;
  postIds?: Array<{ platform: string; id?: string; postUrl?: string; status?: string }>;
  errors?: Array<{ platform?: string; message?: string }>;
}

interface AyrshareAnalyticsResponse {
  [platform: string]:
    | {
        analytics?: {
          impressions?: number;
          views?: number;
          likeCount?: number;
          likes?: number;
          commentsCount?: number;
          comments?: number;
          sharesCount?: number;
          shares?: number;
          retweets?: number;
        };
      }
    | unknown;
}

export interface AyrshareAdapterOptions {
  apiKey: string;
  timeoutMs?: number;
}

export class AyrsharePublisherAdapter implements PublisherAdapter {
  readonly name = 'ayrshare';
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(opts: AyrshareAdapterOptions) {
    if (!opts.apiKey) throw new AdapterError('AYRSHARE_API_KEY missing', this.name);
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? 60_000;
  }

  private headers(brandProfileKey?: string): Record<string, string> {
    const h: Record<string, string> = {
      authorization: `Bearer ${this.apiKey}`,
      'content-type': 'application/json',
    };
    // Business multi-profile: scope the call to a brand's connected accounts.
    if (brandProfileKey) h['Profile-Key'] = brandProfileKey;
    return h;
  }

  /** Enforce per-platform media rules; returns a validation error map. */
  private validateMedia(platforms: Platform[], media: PublishMedia[]): Map<Platform, string> {
    const errors = new Map<Platform, string>();
    const hasVideo = media.some((m) => m.kind === 'video');
    for (const p of platforms) {
      if (MEDIA_REQUIRED.has(p) && media.length === 0) {
        errors.set(p, `${p} requires at least one media item`);
      }
      if (VIDEO_REQUIRED.has(p) && !hasVideo) {
        errors.set(p, `${p} requires a video`);
      }
    }
    return errors;
  }

  async publish(
    post: PublishPost,
    platforms: Platform[],
    media: PublishMedia[],
    brandProfileKey: string,
  ): Promise<PublishResult[]> {
    if (platforms.length === 0) return [];

    const mediaErrors = this.validateMedia(platforms, media);
    const validPlatforms = platforms.filter((p) => !mediaErrors.has(p));

    // Build post text (append hashtags if any).
    const hashtags = post.hashtags?.length ? ' ' + post.hashtags.map((h) => (h.startsWith('#') ? h : `#${h}`)).join(' ') : '';
    const text = `${post.text}${hashtags}`.trim();

    const results: PublishResult[] = [];
    // Emit failed results for platforms blocked by media validation.
    for (const [platform, message] of mediaErrors) {
      results.push({ platform, status: 'failed', error: message });
    }
    if (validPlatforms.length === 0) return results;

    const mediaUrls = media.map((m) => m.url).filter((u): u is string => Boolean(u));
    const body: Record<string, unknown> = {
      post: text,
      platforms: validPlatforms.map(toAyrsharePlatform),
    };
    if (post.title) body.title = post.title;
    if (mediaUrls.length) body.mediaUrls = mediaUrls;

    let resp: AyrsharePostResponse;
    try {
      resp = await httpJson<AyrsharePostResponse>(
        `${API_BASE}/post`,
        { method: 'POST', headers: this.headers(brandProfileKey), body: JSON.stringify(body) },
        { provider: this.name, timeoutMs: this.timeoutMs, retries: 3 },
      );
    } catch (err) {
      // Whole-request failure → mark every valid platform failed.
      const msg = err instanceof Error ? err.message : String(err);
      for (const p of validPlatforms) results.push({ platform: p, status: 'failed', error: msg });
      return results;
    }

    // Map per-platform postIds back to canonical Platform.
    const byPlatform = new Map<Platform, { id?: string; postUrl?: string; status?: string }>();
    for (const item of resp.postIds ?? []) {
      const canonical = fromAyrsharePlatform(item.platform);
      if (canonical) byPlatform.set(canonical, item);
    }

    for (const p of validPlatforms) {
      const item = byPlatform.get(p);
      if (item?.id) {
        const r: PublishResult = { platform: p, status: 'published', externalPostId: item.id };
        if (item.postUrl) r.postUrl = item.postUrl;
        results.push(r);
      } else {
        const errMsg =
          resp.errors?.find((e) => e.platform && fromAyrsharePlatform(e.platform) === p)?.message ??
          (resp.status !== 'success' ? `Ayrshare status=${resp.status}` : 'no post id returned');
        results.push({ platform: p, status: 'failed', error: errMsg });
      }
    }
    return results;
  }

  async fetchAnalytics(
    externalPostId: string,
    platform: Platform,
    brandProfileKey: string,
  ): Promise<AnalyticsSnapshot> {
    const ayr = toAyrsharePlatform(platform);
    let resp: AyrshareAnalyticsResponse;
    try {
      resp = await httpJson<AyrshareAnalyticsResponse>(
        `${API_BASE}/analytics/post`,
        {
          method: 'POST',
          headers: this.headers(brandProfileKey),
          body: JSON.stringify({ id: externalPostId, platforms: [ayr] }),
        },
        { provider: this.name, timeoutMs: this.timeoutMs, retries: 3 },
      );
    } catch (err) {
      throw new AdapterError(`Ayrshare fetchAnalytics failed (${platform})`, this.name, err);
    }

    const entry = resp[ayr] as { analytics?: Record<string, number | undefined> } | undefined;
    const a = entry?.analytics ?? {};
    const snapshot: AnalyticsSnapshot = {
      platform,
      externalPostId,
      capturedAt: new Date().toISOString(),
      raw: resp,
    };
    const views = a.views ?? a.impressions;
    const likes = a.likeCount ?? a.likes;
    const comments = a.commentsCount ?? a.comments;
    const shares = a.sharesCount ?? a.shares ?? a.retweets;
    if (typeof views === 'number') snapshot.views = views;
    if (typeof a.impressions === 'number') snapshot.impressions = a.impressions;
    if (typeof likes === 'number') snapshot.likes = likes;
    if (typeof comments === 'number') snapshot.comments = comments;
    if (typeof shares === 'number') snapshot.shares = shares;
    return snapshot;
  }
}
