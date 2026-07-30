/**
 * PostizPublisherAdapter — skeleton for the future self-host publishing path
 * (ADR-003 scale path: self-host Postiz OSS to drop per-profile aggregator fees
 * once brand count dominates the bill). Implements the same PublisherAdapter
 * interface so it is a drop-in swap for Ayrshare. Left as a documented skeleton:
 * the REST calls are not wired until the self-host cutover, but the shape is in
 * place so the factory can select it behind an env flag without touching
 * consumers.
 */
import type { Platform } from '@marketforge/contracts';

import type {
  PublisherAdapter,
  PublishPost,
  PublishMedia,
} from '../../interfaces/publisher.js';
import type { PublishResult, AnalyticsSnapshot } from '../../interfaces/types.js';
import { NotImplementedError } from '../../errors.js';

export interface PostizAdapterOptions {
  /** Base URL of the self-hosted Postiz instance, e.g. https://postiz.internal */
  baseUrl: string;
  apiKey: string;
  timeoutMs?: number;
}

export class PostizPublisherAdapter implements PublisherAdapter {
  readonly name = 'postiz';
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly timeoutMs: number;

  constructor(opts: PostizAdapterOptions) {
    this.baseUrl = opts.baseUrl.replace(/\/$/, '');
    this.apiKey = opts.apiKey;
    this.timeoutMs = opts.timeoutMs ?? 60_000;
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async publish(
    _post: PublishPost,
    _platforms: Platform[],
    _media: PublishMedia[],
    _brandProfileKey: string,
  ): Promise<PublishResult[]> {
    // TODO(self-host cutover): POST ${baseUrl}/public/v1/posts with per-brand
    // integration ids resolved from _brandProfileKey; map platform + media.
    void this.baseUrl;
    void this.apiKey;
    void this.timeoutMs;
    throw new NotImplementedError('PostizPublisherAdapter.publish (self-host path)');
  }

  async fetchAnalytics(
    _externalPostId: string,
    _platform: Platform,
    _brandProfileKey: string,
  ): Promise<AnalyticsSnapshot> {
    throw new NotImplementedError('PostizPublisherAdapter.fetchAnalytics (self-host path)');
  }
}
