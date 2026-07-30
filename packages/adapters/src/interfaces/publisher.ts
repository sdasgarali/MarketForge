import type { Platform } from '@marketforge/contracts';
import type { PublishResult, AnalyticsSnapshot } from './types.js';

export interface PublishPost { text: string; title?: string; hashtags?: string[]; }
export interface PublishMedia { key: string; url?: string; kind: 'image' | 'video' | 'gif'; }

export interface PublisherAdapter {
  readonly name: string;
  publish(post: PublishPost, platforms: Platform[], media: PublishMedia[], brandProfileKey: string): Promise<PublishResult[]>;
  fetchAnalytics(externalPostId: string, platform: Platform, brandProfileKey: string): Promise<AnalyticsSnapshot>;
}
