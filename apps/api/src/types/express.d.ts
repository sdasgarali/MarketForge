import type { TenantContext } from '@marketforge/auth';

/**
 * Express request augmentation. `id` is the per-request correlation id set by the
 * requestId middleware; `ctx` is the resolved tenant context attached by the
 * authContext middleware (present on all authenticated routes).
 */
declare global {
  namespace Express {
    interface Request {
      id: string;
      ctx?: TenantContext;
    }
  }
}

export {};
