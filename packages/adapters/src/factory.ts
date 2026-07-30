/**
 * Adapter registry / factory (ADR-007). Assembles the concrete set of adapters
 * used by the app. TODAY it wires the safe STUBS; as real backends land in
 * `src/impl/*` (owned by another agent), swap each slot here — the interface
 * contract in `src/interfaces/*` keeps every downstream consumer untouched.
 */
import { createLogger } from '@marketforge/logger';
import { env as realEnv } from '@marketforge/config';

import type { LlmAdapter } from './interfaces/llm.js';
import type { ImageAdapter } from './interfaces/image.js';
import type { VideoAdapter } from './interfaces/video.js';
import type { VoiceAdapter } from './interfaces/voice.js';
import type { PublisherAdapter } from './interfaces/publisher.js';
import type { StorageAdapter } from './interfaces/storage.js';

import { StubLlmAdapter } from './stubs/stub-llm.js';
import { StubImageAdapter } from './stubs/stub-image.js';
import { StubVideoAdapter } from './stubs/stub-video.js';
import { StubVoiceAdapter } from './stubs/stub-voice.js';
import { StubPublisherAdapter } from './stubs/stub-publisher.js';
import { StubStorageAdapter } from './stubs/stub-storage.js';

/** The full set of provider seams the platform depends on. */
export interface Adapters {
  llm: LlmAdapter;
  image: ImageAdapter;
  video: VideoAdapter;
  voice: VoiceAdapter;
  publisher: PublisherAdapter;
  storage: StorageAdapter;
}

/**
 * Minimal, loose view of the config `env` the factory reads. Kept local (rather
 * than importing the strict `Env` type) so callers can pass partial/injected
 * env in tests. Real impls read the relevant keys to decide stub vs live.
 */
export interface AdapterEnv {
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  FAL_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  AYRSHARE_API_KEY?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  GOOGLE_DRIVE_FOLDER_ID?: string;
  [key: string]: unknown;
}

/**
 * Build the adapter set. Wires stubs today; each slot is a swap-point for the
 * real impl. `env` is accepted so real impls can branch on presence of keys
 * (e.g. use the live provider when its key is set, else fall back to a stub).
 */
export function createAdapters(env: AdapterEnv): Adapters {
  const log = createLogger({ service: 'adapters' });

  // TODO(impl): swap StubLlmAdapter -> AnthropicLlmAdapter + router (Sonnet/Opus/
  // Gemini/Groq by task+cost) when packages/adapters/src/impl/llm.ts lands.
  const llm: LlmAdapter = new StubLlmAdapter();

  // TODO(impl): swap StubImageAdapter -> NanoBanana2/Fal image adapter.
  const image: ImageAdapter = new StubImageAdapter();

  // TODO(impl): swap StubVideoAdapter -> Veo/Runway/Kling(via fal) adapter (Phase 3).
  const video: VideoAdapter = new StubVideoAdapter();

  // TODO(impl): swap StubVoiceAdapter -> ElevenLabs adapter.
  const voice: VoiceAdapter = new StubVoiceAdapter();

  // TODO(impl): swap StubPublisherAdapter -> AyrshareAdapter (per-brand profileKey).
  const publisher: PublisherAdapter = new StubPublisherAdapter();

  // TODO(impl): swap StubStorageAdapter -> S3Adapter (+ Google Drive mirror).
  const storage: StorageAdapter = new StubStorageAdapter();

  const adapters: Adapters = { llm, image, video, voice, publisher, storage };

  // Log which backend (stub vs real) was selected per slot — every slot that
  // still starts with `stub-` is pending a real impl.
  log.info(
    {
      event: 'adapters_wired',
      llm: llm.name,
      image: image.name,
      video: video.name,
      voice: voice.name,
      publisher: publisher.name,
      storage: storage.name,
      // Surfaced so the config env is genuinely consulted (real impls branch on these).
      hasAnthropicKey: Boolean(env.ANTHROPIC_API_KEY),
      hasFalKey: Boolean(env.FAL_API_KEY),
      hasElevenLabsKey: Boolean(env.ELEVENLABS_API_KEY),
      hasAyrshareKey: Boolean(env.AYRSHARE_API_KEY),
      hasS3: Boolean(env.S3_BUCKET),
    },
    'adapters wired',
  );

  return adapters;
}

/**
 * Default, ready-to-use adapter singleton built from the real config env.
 * Import this in apps; import `createAdapters` when you need a custom/test env.
 */
export const adapters: Adapters = createAdapters(realEnv as unknown as AdapterEnv);
