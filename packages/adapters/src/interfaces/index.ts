/**
 * Adapter interfaces (ADR-007). This is the stable downstream contract: every
 * AI/image/video/voice/publisher/storage backend is accessed through one of
 * these seams so providers are replaceable. Real impls live in `src/impl/*`.
 */
export type {
  GeneratedText,
  GeneratedImage,
  GeneratedVideo,
  GeneratedVoice,
  PublishResult,
  AnalyticsSnapshot,
  StoredObject,
} from './types.js';

export type { LlmAdapter, LlmGenerateOptions } from './llm.js';
export type { ImageAdapter, ImageGenerateOptions } from './image.js';
export type { VideoAdapter, VideoGenerateOptions } from './video.js';
export type { VoiceAdapter, VoiceGenerateOptions } from './voice.js';
export type { PublisherAdapter, PublishPost, PublishMedia } from './publisher.js';
export type { StorageAdapter } from './storage.js';
