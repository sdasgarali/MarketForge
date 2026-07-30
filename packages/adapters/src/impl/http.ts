/**
 * Shared HTTP helper for real adapters: fetch with timeout + bounded
 * exponential backoff on transient failures (429 / 5xx / network). Uses the
 * global `fetch` (Node 18+/undici). No secrets are logged here — callers pass
 * headers; this module never inspects or emits them.
 */
import { AdapterError } from '../errors.js';

export interface HttpRetryOptions {
  /** Max attempts (including the first). Default 3. */
  retries?: number;
  /** Per-request timeout in ms. Default 60_000. */
  timeoutMs?: number;
  /** Base backoff in ms (grows exponentially with jitter). Default 500. */
  baseDelayMs?: number;
  /** Provider label for AdapterError. */
  provider: string;
  /** AbortSignal from caller (merged with the timeout signal). */
  signal?: AbortSignal;
}

/** Status codes we consider retryable. */
const RETRYABLE = new Set([408, 425, 429, 500, 502, 503, 504]);

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

function backoffDelay(attempt: number, base: number): number {
  // Exponential with full jitter, capped at 20s.
  const exp = Math.min(base * 2 ** attempt, 20_000);
  return Math.round(Math.random() * exp);
}

/**
 * fetch wrapper with timeout + retry/backoff. Returns the raw Response on a
 * final success; throws AdapterError after exhausting retries or on a
 * non-retryable error status (the caller decides how to read the body).
 */
export async function httpFetch(
  url: string,
  init: RequestInit,
  opts: HttpRetryOptions,
): Promise<Response> {
  const { retries = 3, timeoutMs = 60_000, baseDelayMs = 500, provider } = opts;
  let lastErr: unknown;

  for (let attempt = 0; attempt < retries; attempt++) {
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(new Error('timeout')), timeoutMs);
    // Merge caller signal + timeout signal.
    const signal = opts.signal
      ? anySignal([opts.signal, timeout.signal])
      : timeout.signal;
    try {
      const res = await fetch(url, { ...init, signal });
      if (RETRYABLE.has(res.status) && attempt < retries - 1) {
        const retryAfter = parseRetryAfter(res.headers.get('retry-after'));
        await sleep(retryAfter ?? backoffDelay(attempt, baseDelayMs));
        lastErr = new AdapterError(`HTTP ${res.status} from ${provider}`, provider);
        continue;
      }
      return res;
    } catch (err) {
      lastErr = err;
      // AbortError / network — retry unless last attempt.
      if (attempt < retries - 1) {
        await sleep(backoffDelay(attempt, baseDelayMs));
        continue;
      }
    } finally {
      clearTimeout(timer);
    }
  }
  throw new AdapterError(
    `HTTP request to ${provider} failed after ${retries} attempt(s)`,
    provider,
    lastErr,
  );
}

/** Fetch JSON with retry; throws AdapterError on non-2xx (body captured). */
export async function httpJson<T>(
  url: string,
  init: RequestInit,
  opts: HttpRetryOptions,
): Promise<T> {
  const res = await httpFetch(url, init, opts);
  const text = await res.text();
  if (!res.ok) {
    throw new AdapterError(
      `HTTP ${res.status} from ${opts.provider}: ${truncate(text, 500)}`,
      opts.provider,
    );
  }
  try {
    return (text ? JSON.parse(text) : {}) as T;
  } catch (err) {
    throw new AdapterError(`Invalid JSON from ${opts.provider}`, opts.provider, err);
  }
}

function parseRetryAfter(header: string | null): number | null {
  if (!header) return null;
  const secs = Number(header);
  if (Number.isFinite(secs)) return Math.min(secs * 1000, 20_000);
  const date = Date.parse(header);
  if (Number.isFinite(date)) return Math.max(0, Math.min(date - Date.now(), 20_000));
  return null;
}

function truncate(s: string, n: number): string {
  return s.length > n ? `${s.slice(0, n)}…` : s;
}

/** Minimal AbortSignal.any polyfill (Node <20 lacks it). */
function anySignal(signals: AbortSignal[]): AbortSignal {
  // Use native when available.
  const anyFn = (AbortSignal as unknown as { any?: (s: AbortSignal[]) => AbortSignal }).any;
  if (typeof anyFn === 'function') return anyFn(signals);
  const controller = new AbortController();
  const onAbort = (): void => {
    controller.abort();
    for (const s of signals) s.removeEventListener('abort', onAbort);
  };
  for (const s of signals) {
    if (s.aborted) {
      controller.abort();
      break;
    }
    s.addEventListener('abort', onAbort, { once: true });
  }
  return controller.signal;
}
