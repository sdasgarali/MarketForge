/**
 * Worker error taxonomy. `TerminalError` marks a failure that must NOT be
 * retried by BullMQ (bad input, policy violation, missing prerequisite) — the
 * processor routes it straight to the DLQ + notify. Everything else is treated
 * as transient and left to BullMQ's retry/backoff.
 */

/** A non-retryable failure. Processors route these to DLQ immediately. */
export class TerminalError extends Error {
  readonly terminal = true as const;
  readonly detail?: unknown;
  constructor(message: string, detail?: unknown) {
    super(message);
    this.name = 'TerminalError';
    this.detail = detail;
  }
}

/** Type guard for {@link TerminalError}. */
export function isTerminalError(err: unknown): err is TerminalError {
  return err instanceof TerminalError || (typeof err === 'object' && err !== null && 'terminal' in err && (err as { terminal?: unknown }).terminal === true);
}

/** Normalize an unknown thrown value into an Error with a readable message. */
export function toError(err: unknown): Error {
  if (err instanceof Error) return err;
  return new Error(typeof err === 'string' ? err : JSON.stringify(err));
}
