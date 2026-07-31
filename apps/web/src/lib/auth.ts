'use client';

import { setActiveOrgId } from './api-client';
import { env } from './env';

/**
 * Client-side auth for the manual JWT flow. The token + a light user profile are
 * kept in localStorage; the api-client reads the token and sends it as a Bearer
 * header. No Clerk, no cookies — logout is just clearing storage.
 */
const TOKEN_KEY = 'marketforge-token';
const USER_KEY = 'marketforge-user';

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  org_id: string;
  role: string;
}

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(TOKEN_KEY);
}

export function getStoredUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem(USER_KEY);
  try {
    return raw ? (JSON.parse(raw) as AuthUser) : null;
  } catch {
    return null;
  }
}

export function isAuthenticated(): boolean {
  return !!getToken();
}

function persist(token: string, user: AuthUser): void {
  window.localStorage.setItem(TOKEN_KEY, token);
  window.localStorage.setItem(USER_KEY, JSON.stringify(user));
}

export function clearAuth(): void {
  window.localStorage.removeItem(TOKEN_KEY);
  window.localStorage.removeItem(USER_KEY);
}

async function postAuth(
  path: string,
  body: Record<string, unknown>,
): Promise<{ token: string; user: AuthUser }> {
  const res = await fetch(`${env.apiBaseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  const data = (await res.json().catch(() => ({}))) as {
    token?: string;
    user?: AuthUser;
    error?: { message?: string };
    message?: string;
  };
  if (!res.ok || !data.token || !data.user) {
    throw new Error(
      data.error?.message ?? data.message ?? `Request failed (${res.status})`,
    );
  }
  persist(data.token, data.user);
  // Reflect the user's real tenant in the client (the API scopes by the token's
  // org regardless, but keep the UI's active org consistent).
  setActiveOrgId(data.user.org_id);
  return { token: data.token, user: data.user };
}

export async function login(email: string, password: string): Promise<AuthUser> {
  const { user } = await postAuth('/auth/login', { email, password });
  return user;
}

export async function register(
  email: string,
  password: string,
  name?: string,
): Promise<AuthUser> {
  const { user } = await postAuth('/auth/register', { email, password, name });
  return user;
}

export function logout(): void {
  clearAuth();
  if (typeof window !== 'undefined') window.location.href = '/sign-in';
}
