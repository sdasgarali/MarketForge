/**
 * Barrel for the real adapter implementations (ADR-007). These are the
 * production-shaped classes that replace the stubs; the factory selects among
 * them by env flags, falling back to stubs when a provider key is absent.
 */

// LLM
export { AnthropicLlmAdapter } from './llm/anthropic.js';
export { OpenAiLlmAdapter } from './llm/openai.js';
export { GeminiLlmAdapter } from './llm/gemini.js';
export { GroqLlmAdapter } from './llm/groq.js';
export { OpenRouterLlmAdapter } from './llm/openrouter.js';
export { RoutingLlmAdapter, planChain, providerForModelHint } from './llm/routing.js';
export type { RoutingProviders } from './llm/routing.js';

// Image
export { FalImageAdapter, FAL_IMAGE_MODELS } from './image/fal-image.js';
export { NanoBananaImageAdapter } from './image/nano-banana.js';

// Video
export { FalVideoAdapter, FAL_VIDEO_MODELS } from './video/fal-video.js';

// Voice
export { ElevenLabsVoiceAdapter } from './voice/elevenlabs.js';
export { alignmentToSrt, alignmentToCues, cuesToSrt } from './voice/subtitles.js';

// Publisher
export { AyrsharePublisherAdapter } from './publisher/ayrshare.js';
export { PostizPublisherAdapter } from './publisher/postiz.js';
export {
  toAyrsharePlatform,
  toAyrsharePlatforms,
  fromAyrsharePlatform,
  PLATFORM_TO_AYRSHARE,
} from './publisher/platform-map.js';

// Storage
export { S3StorageAdapter } from './storage/s3.js';
export { LocalDiskStorageAdapter } from './storage/localdisk.js';
export { DriveMirror } from './storage/drive-mirror.js';
export { GDriveClient, type GDriveConfig, type DriveFile } from './storage/gdrive-client.js';

// Pricing + cost helpers
export {
  LLM_PRICING,
  IMAGE_PRICING,
  VIDEO_PRICING_PER_SEC,
  llmCostUsd,
  imageCostUsd,
  videoCostUsd,
  voiceCostUsd,
} from './pricing.js';
