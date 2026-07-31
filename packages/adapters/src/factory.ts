/**
 * Adapter registry / factory (ADR-007). Assembles the concrete set of adapters
 * the app uses, selecting the REAL implementation for each slot when its
 * provider key/config is present in `env`, and falling back to the safe STUB
 * otherwise so dev runs never crash on a missing key. Nothing here throws at
 * import time — construction is guarded and failures degrade to a stub.
 *
 * Selection summary:
 *   - llm:       RoutingLlmAdapter over whichever providers have keys
 *                (Anthropic/OpenAI/Gemini/Groq/OpenRouter). No keys → stub.
 *   - image:     FalImageAdapter if FAL_API_KEY else stub.
 *   - video:     FalVideoAdapter if FAL_API_KEY else stub (Phase 3).
 *   - voice:     ElevenLabsVoiceAdapter if ELEVENLABS_API_KEY else stub.
 *   - publisher: AyrsharePublisherAdapter if AYRSHARE_API_KEY else stub.
 *   - storage:   S3StorageAdapter if S3 fully configured, else
 *                LocalDiskStorageAdapter under DATA_DIR (dev default).
 */
import { AsyncLocalStorage } from 'node:async_hooks';
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

import { AnthropicLlmAdapter } from './impl/llm/anthropic.js';
import { OpenAiLlmAdapter } from './impl/llm/openai.js';
import { GeminiLlmAdapter } from './impl/llm/gemini.js';
import { GroqLlmAdapter } from './impl/llm/groq.js';
import { OpenRouterLlmAdapter } from './impl/llm/openrouter.js';
import { RoutingLlmAdapter, type RoutingProviders } from './impl/llm/routing.js';
import { FalImageAdapter } from './impl/image/fal-image.js';
import { FalVideoAdapter } from './impl/video/fal-video.js';
import { ElevenLabsVoiceAdapter } from './impl/voice/elevenlabs.js';
import { AyrsharePublisherAdapter } from './impl/publisher/ayrshare.js';
import { S3StorageAdapter } from './impl/storage/s3.js';
import { LocalDiskStorageAdapter } from './impl/storage/localdisk.js';

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
 * Loose view of the config `env` the factory reads. Kept local (rather than
 * importing the strict `Env` type) so callers can pass partial/injected env in
 * tests.
 */
export interface AdapterEnv {
  ANTHROPIC_API_KEY?: string;
  OPENAI_API_KEY?: string;
  GEMINI_API_KEY?: string;
  GROQ_API_KEY?: string;
  OPENROUTER_API_KEY?: string;
  FAL_API_KEY?: string;
  ELEVENLABS_API_KEY?: string;
  AYRSHARE_API_KEY?: string;
  S3_ENDPOINT?: string;
  S3_REGION?: string;
  S3_BUCKET?: string;
  S3_ACCESS_KEY_ID?: string;
  S3_SECRET_ACCESS_KEY?: string;
  S3_FORCE_PATH_STYLE?: boolean;
  S3_PUBLIC_BASE_URL?: string;
  DATA_DIR?: string;
  GOOGLE_DRIVE_FOLDER_ID?: string;
  [key: string]: unknown;
}

type Log = ReturnType<typeof createLogger>;

/** Build the routing LLM from whichever providers have keys. */
function buildLlm(env: AdapterEnv, log: Log): LlmAdapter {
  const providers: RoutingProviders = {};
  try {
    if (env.ANTHROPIC_API_KEY)
      providers.anthropic = new AnthropicLlmAdapter({ apiKey: env.ANTHROPIC_API_KEY });
    if (env.OPENAI_API_KEY)
      providers.openai = new OpenAiLlmAdapter({ apiKey: env.OPENAI_API_KEY });
    if (env.GEMINI_API_KEY)
      providers.gemini = new GeminiLlmAdapter({ apiKey: env.GEMINI_API_KEY });
    if (env.GROQ_API_KEY) providers.groq = new GroqLlmAdapter({ apiKey: env.GROQ_API_KEY });
    if (env.OPENROUTER_API_KEY)
      providers.openrouter = new OpenRouterLlmAdapter({ apiKey: env.OPENROUTER_API_KEY });

    if (Object.keys(providers).length > 0) return new RoutingLlmAdapter(providers);
  } catch (err) {
    log.warn({ event: 'llm_init_failed', err: String(err) }, 'LLM init failed; using stub');
  }
  return new StubLlmAdapter();
}

function buildImage(env: AdapterEnv, log: Log): ImageAdapter {
  if (env.FAL_API_KEY) {
    try {
      return new FalImageAdapter({ apiKey: env.FAL_API_KEY });
    } catch (err) {
      log.warn({ event: 'image_init_failed', err: String(err) }, 'Fal image init failed');
    }
  }
  return new StubImageAdapter();
}

function buildVideo(env: AdapterEnv, log: Log): VideoAdapter {
  if (env.FAL_API_KEY) {
    try {
      return new FalVideoAdapter({ apiKey: env.FAL_API_KEY });
    } catch (err) {
      log.warn({ event: 'video_init_failed', err: String(err) }, 'Fal video init failed');
    }
  }
  return new StubVideoAdapter();
}

function buildVoice(env: AdapterEnv, log: Log): VoiceAdapter {
  if (env.ELEVENLABS_API_KEY) {
    try {
      return new ElevenLabsVoiceAdapter({ apiKey: env.ELEVENLABS_API_KEY });
    } catch (err) {
      log.warn({ event: 'voice_init_failed', err: String(err) }, 'ElevenLabs init failed');
    }
  }
  return new StubVoiceAdapter();
}

function buildPublisher(env: AdapterEnv, log: Log): PublisherAdapter {
  if (env.AYRSHARE_API_KEY) {
    try {
      return new AyrsharePublisherAdapter({ apiKey: env.AYRSHARE_API_KEY });
    } catch (err) {
      log.warn({ event: 'publisher_init_failed', err: String(err) }, 'Ayrshare init failed');
    }
  }
  return new StubPublisherAdapter();
}

function buildStorage(env: AdapterEnv, log: Log): StorageAdapter {
  const s3Ready = Boolean(
    env.S3_BUCKET && env.S3_ACCESS_KEY_ID && env.S3_SECRET_ACCESS_KEY,
  );
  if (s3Ready) {
    try {
      return new S3StorageAdapter({
        bucket: env.S3_BUCKET as string,
        accessKeyId: env.S3_ACCESS_KEY_ID as string,
        secretAccessKey: env.S3_SECRET_ACCESS_KEY as string,
        ...(env.S3_REGION ? { region: env.S3_REGION } : {}),
        ...(env.S3_ENDPOINT ? { endpoint: env.S3_ENDPOINT } : {}),
        ...(env.S3_FORCE_PATH_STYLE !== undefined
          ? { forcePathStyle: env.S3_FORCE_PATH_STYLE }
          : {}),
        ...(env.S3_PUBLIC_BASE_URL ? { publicBaseUrl: env.S3_PUBLIC_BASE_URL } : {}),
      });
    } catch (err) {
      log.warn({ event: 'storage_init_failed', err: String(err) }, 'S3 init failed; local disk');
    }
  }
  if (env.DATA_DIR) return new LocalDiskStorageAdapter({ rootDir: env.DATA_DIR });
  // No S3 and no DATA_DIR → in-memory stub (last resort, never crash).
  return new StubStorageAdapter();
}

/** Build the adapter set, selecting real impls behind env flags. */
export function createAdapters(env: AdapterEnv): Adapters {
  const log = createLogger({ service: 'adapters' });

  const adapters: Adapters = {
    llm: buildLlm(env, log),
    image: buildImage(env, log),
    video: buildVideo(env, log),
    voice: buildVoice(env, log),
    publisher: buildPublisher(env, log),
    storage: buildStorage(env, log),
  };

  log.info(
    {
      event: 'adapters_wired',
      llm: adapters.llm.name,
      image: adapters.image.name,
      video: adapters.video.name,
      voice: adapters.voice.name,
      publisher: adapters.publisher.name,
      storage: adapters.storage.name,
    },
    'adapters wired',
  );

  return adapters;
}

/**
 * Default adapter bundle built from the process env (keys from the deployment).
 */
const defaultAdapters: Adapters = createAdapters(realEnv as unknown as AdapterEnv);

/**
 * Per-request adapter override. The worker builds a PER-ORG adapter bundle from
 * that org's saved provider keys and runs each job inside `runWithAdapters`, so
 * every `adapters.*` call (in processors and agents) transparently uses the
 * org's own keys — no plumbing through every call site.
 */
const adapterContext = new AsyncLocalStorage<Adapters>();

export function runWithAdapters<T>(bundle: Adapters, fn: () => T): T {
  return adapterContext.run(bundle, fn);
}

/**
 * The adapter bundle to use. Proxies to the org-scoped bundle when one is active
 * (inside `runWithAdapters`), else the default env-built singleton.
 */
export const adapters: Adapters = new Proxy(defaultAdapters, {
  get(target, prop: string) {
    const active = adapterContext.getStore() ?? target;
    return active[prop as keyof Adapters];
  },
}) as Adapters;
