/**
 * Safe stub adapters — deterministic, dependency-free implementations of every
 * adapter interface so `@marketforge/adapters` compiles and runs standalone
 * (no real provider SDKs). Real impls land in `src/impl/*` and replace these
 * via the factory (see `src/factory.ts`).
 */
export { StubLlmAdapter } from './stub-llm.js';
export { StubImageAdapter } from './stub-image.js';
export { StubVideoAdapter } from './stub-video.js';
export { StubVoiceAdapter } from './stub-voice.js';
export { StubPublisherAdapter } from './stub-publisher.js';
export { StubStorageAdapter } from './stub-storage.js';
