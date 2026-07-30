import type { Platform, Usage } from '@marketforge/contracts';

export interface GeneratedText { text: string; usage: Usage; }
export interface GeneratedImage { url?: string; b64?: string; storageKey?: string; usage: Usage; width?: number; height?: number; }
export interface GeneratedVideo { url?: string; storageKey?: string; durationMs: number; usage: Usage; hasAudio: boolean; }
export interface GeneratedVoice { url?: string; b64?: string; storageKey?: string; durationMs: number; usage: Usage; subtitles?: string; }
export interface PublishResult { platform: Platform; externalPostId?: string; postUrl?: string; status: 'published' | 'failed'; error?: string; }
export interface AnalyticsSnapshot { platform: Platform; externalPostId: string; views?: number; likes?: number; comments?: number; shares?: number; impressions?: number; capturedAt: string; raw?: unknown; }
export interface StoredObject { key: string; url?: string; bytes?: number; }
