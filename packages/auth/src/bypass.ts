import { createLogger } from '@marketforge/logger';
import type { AuthProvider, AuthRequestLike } from './provider.js';
import { extractActiveOrg } from './provider.js';
import type { TenantContext } from './context.js';

const log = createLogger({ service: 'auth' });

/** Stable fake principal + org for local dev without Clerk. */
const BYPASS_USER_ID = '00000000-0000-0000-0000-000000000001';
const BYPASS_ORG_ID = '00000000-0000-0000-0000-0000000000aa';
const BYPASS_EMAIL = 'dev-admin@marketforge.dev';

let warned = false;

/**
 * DEV-only provider that injects a fixed fake admin + org so the full stack can
 * run with no Clerk keys. Env-gated by DEV_AUTH_BYPASS and FORBIDDEN in PROD
 * (the config loader rejects bypass+PROD, so this class can never be selected
 * there). Devs can simulate a different org by sending an `x-org-id` header.
 */
export class BypassAuthProvider implements AuthProvider {
  async resolve(req: AuthRequestLike): Promise<TenantContext> {
    if (!warned) {
      warned = true;
      log.warn(
        { isBypass: true },
        'DEV_AUTH_BYPASS active — injecting fake admin/org. Never use in PROD.',
      );
    }

    const orgId = extractActiveOrg(req) ?? BYPASS_ORG_ID;

    return {
      orgId,
      user: {
        id: BYPASS_USER_ID,
        email: BYPASS_EMAIL,
        fullName: 'Dev Admin',
      },
      role: 'admin',
      isBypass: true,
    };
  }
}
