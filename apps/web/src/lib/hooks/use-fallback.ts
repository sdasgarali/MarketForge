import { ApiError } from '../api-client';

/**
 * Wrap an API call so that when the API is unreachable (network error / 5xx /
 * connection refused) we fall back to mock data rather than erroring the page.
 * This is a dev affordance — the UI surfaces a "demo data" badge when it kicks
 * in. Real 4xx errors (auth, validation) still propagate so bugs stay visible.
 */
export interface Fallbackable<T> {
  data: T;
  isMock: boolean;
}

function isNetworkFailure(err: unknown): boolean {
  if (err instanceof ApiError) {
    // 5xx or 0 → treat as infra-down; 4xx → real, propagate.
    return err.status >= 500 || err.status === 0;
  }
  // fetch throws TypeError('Failed to fetch') on connection refused / CORS.
  return err instanceof TypeError;
}

export async function withFallback<T>(
  fn: () => Promise<T>,
  mock: () => T,
): Promise<Fallbackable<T>> {
  try {
    return { data: await fn(), isMock: false };
  } catch (err) {
    if (isNetworkFailure(err)) {
      return { data: mock(), isMock: true };
    }
    throw err;
  }
}
