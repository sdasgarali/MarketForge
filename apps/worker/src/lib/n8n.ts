/**
 * n8n webhook bridge (ADR-005). The backend decides *what/when*; n8n does the
 * external-API *doing*. We POST a JSON payload to a modular sub-workflow webhook
 * and sign it with an HMAC-SHA256 header so n8n can verify the caller.
 *
 * `isN8nEnabled()` decides the publish switch: when N8N_WEBHOOK_SECRET is set we
 * prefer n8n; otherwise processors fall back to calling the adapter directly.
 */
import { createHmac } from 'node:crypto';
import { request } from 'undici';
import { env } from '@marketforge/config';
import { createLogger } from '@marketforge/logger';
import { SERVICE } from './constants.js';

const log = createLogger({ service: SERVICE, workflow: 'n8n-bridge' });

/** Header carrying the HMAC signature of the raw request body. */
export const N8N_SIGNATURE_HEADER = 'x-mf-signature';

/**
 * n8n is the preferred execution path only when a shared secret is configured
 * (so requests are authenticated). Without it we fall back to direct adapters.
 */
export function isN8nEnabled(): boolean {
  return Boolean(env.N8N_WEBHOOK_SECRET);
}

/** Compute the hex HMAC-SHA256 of a body using the shared n8n secret. */
export function signBody(body: string, secret: string): string {
  return createHmac('sha256', secret).update(body).digest('hex');
}

export interface N8nResponse<T = unknown> {
  ok: boolean;
  status: number;
  body: T;
}

/**
 * POST a signed JSON payload to an n8n sub-workflow webhook (path relative to
 * N8N_WEBHOOK_BASE_URL, e.g. `/webhook/wf-publish`). Throws on network error or
 * non-2xx so the caller can fall back / retry.
 */
export async function callN8n<T = unknown>(path: string, payload: unknown, timeoutMs = 30_000): Promise<N8nResponse<T>> {
  const secret = env.N8N_WEBHOOK_SECRET;
  if (!secret) {
    throw new Error('callN8n invoked without N8N_WEBHOOK_SECRET configured');
  }
  const base = env.N8N_WEBHOOK_BASE_URL.replace(/\/$/, '');
  // N8N_WEBHOOK_BASE_URL already ends in `/webhook`; strip a leading `/webhook`
  // from the path if the caller passed the full sub-path.
  const relative = path.startsWith('/webhook') ? path.slice('/webhook'.length) : path;
  const url = `${base}${relative.startsWith('/') ? relative : `/${relative}`}`;

  const body = JSON.stringify(payload);
  const signature = signBody(body, secret);

  const res = await request(url, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      [N8N_SIGNATURE_HEADER]: signature,
    },
    body,
    headersTimeout: timeoutMs,
    bodyTimeout: timeoutMs,
  });

  const text = await res.body.text();
  let parsed: unknown = text;
  try {
    parsed = text ? JSON.parse(text) : {};
  } catch {
    // leave as raw text
  }

  const ok = res.statusCode >= 200 && res.statusCode < 300;
  if (!ok) {
    log.warn({ url, status: res.statusCode }, 'n8n webhook returned non-2xx');
    throw new Error(`n8n webhook ${path} failed with status ${res.statusCode}`);
  }
  return { ok, status: res.statusCode, body: parsed as T };
}
