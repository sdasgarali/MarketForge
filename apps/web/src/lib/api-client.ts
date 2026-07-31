import { clerkEnabled, env } from './env';

/**
 * Clerk global exposed on the window once ClerkProvider is mounted. We read the
 * session token from here (rather than a React hook) so the plain fetch client
 * can attach `Authorization: Bearer <token>` without threading a hook through
 * every call site. `getToken()` always returns a fresh, short-lived JWT.
 */
interface ClerkWindow {
  Clerk?: { session?: { getToken: () => Promise<string | null> } | null };
}

async function getAuthToken(): Promise<string | null> {
  if (!clerkEnabled || typeof window === 'undefined') return null;
  try {
    const clerk = (window as unknown as ClerkWindow).Clerk;
    return (await clerk?.session?.getToken()) ?? null;
  } catch {
    return null;
  }
}

/**
 * Typed fetch client for the MarketForge API.
 *
 * - Sends the active `x-org-id` header for multi-tenant scoping (set by the org
 *   switcher via `setActiveOrgId`).
 * - Normalizes errors into `ApiError`.
 * - `USE_MOCK` short-circuits to local mock data so pages render when the API
 *   is unreachable (a clearly-flagged dev affordance; real hooks still hit the
 *   API first and only fall back on network error).
 */

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public detail?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let activeOrgId: string | null = null;

export function setActiveOrgId(orgId: string | null) {
  activeOrgId = orgId;
}

export function getActiveOrgId() {
  return activeOrgId;
}

interface RequestOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Skip JSON parse (for 204). */
  raw?: boolean;
}

function buildUrl(path: string, query?: RequestOptions['query']): string {
  const url = new URL(
    path.startsWith('http') ? path : `${env.apiBaseUrl}${path}`,
  );
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, String(v));
      }
    }
  }
  return url.toString();
}

export async function apiFetch<T>(
  path: string,
  opts: RequestOptions = {},
): Promise<T> {
  const { body, query, headers, raw, ...rest } = opts;

  const token = await getAuthToken();

  const res = await fetch(buildUrl(path, query), {
    ...rest,
    headers: {
      'content-type': 'application/json',
      ...(token ? { authorization: `Bearer ${token}` } : {}),
      ...(activeOrgId ? { 'x-org-id': activeOrgId } : {}),
      ...(headers ?? {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
    // Credentials so Clerk session cookies flow through when enabled.
    credentials: 'include',
  });

  if (!res.ok) {
    let detail: unknown;
    let message = `${res.status} ${res.statusText}`;
    try {
      detail = await res.json();
      if (
        detail &&
        typeof detail === 'object' &&
        'message' in detail &&
        typeof (detail as { message: unknown }).message === 'string'
      ) {
        message = (detail as { message: string }).message;
      }
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, message, detail);
  }

  if (raw || res.status === 204) return undefined as T;
  return (await res.json()) as T;
}
