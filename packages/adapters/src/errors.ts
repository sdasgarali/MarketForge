/**
 * Adapter error taxonomy. Two shapes:
 *  - `NotImplementedError` — a stub slot whose real backend has not landed yet.
 *    Real impls in `src/impl/*` (owned by another agent) remove these.
 *  - `AdapterError` — a runtime failure from a (real) adapter, carrying the
 *    originating provider + underlying cause for structured logging.
 */

/**
 * Thrown by stubs (or unfinished slots) to signal "real implementation pending".
 * Downstream code can catch this to distinguish a not-yet-built backend from a
 * genuine provider failure.
 */
export class NotImplementedError extends Error {
  override readonly name = 'NotImplementedError';

  constructor(what: string) {
    super(`Not implemented yet: ${what}. Real impl pending in src/impl/.`);
    // Restore prototype chain (TS + extending built-ins).
    Object.setPrototypeOf(this, NotImplementedError.prototype);
  }
}

/**
 * A failure originating from an adapter/provider. `provider` is the logical
 * backend identifier (e.g. 'anthropic', 'fal', 'ayrshare', 's3'); `cause` is
 * the underlying error, if any.
 */
export class AdapterError extends Error {
  override readonly name = 'AdapterError';
  readonly provider: string;
  override readonly cause?: unknown;

  constructor(message: string, provider: string, cause?: unknown) {
    super(message);
    this.provider = provider;
    this.cause = cause;
    Object.setPrototypeOf(this, AdapterError.prototype);
  }
}
