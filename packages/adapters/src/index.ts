/**
 * @marketforge/adapters — the replaceable-provider seam (ADR-007).
 *
 * Public surface:
 *  - Adapter INTERFACES + shared request/response types (`./interfaces`).
 *  - The `Adapters` set + `createAdapters(env)` factory + `adapters` singleton.
 *  - Error types (`NotImplementedError`, `AdapterError`).
 *  - The safe STUB classes (for tests/apps that need to construct them directly).
 *
 * Real provider impls land in `src/impl/*` (owned by another agent) and are
 * swapped in via `src/factory.ts` — consumers of the interfaces stay unchanged.
 */

// Interfaces + shared types (the stable downstream contract).
export * from './interfaces/index.js';

// Factory / registry.
export type { Adapters, AdapterEnv } from './factory.js';
export { createAdapters, adapters } from './factory.js';

// Errors.
export { NotImplementedError, AdapterError } from './errors.js';

// Stub implementations (referenceable by tests/apps).
export {
  StubLlmAdapter,
  StubImageAdapter,
  StubVideoAdapter,
  StubVoiceAdapter,
  StubPublisherAdapter,
  StubStorageAdapter,
} from './stubs/index.js';
