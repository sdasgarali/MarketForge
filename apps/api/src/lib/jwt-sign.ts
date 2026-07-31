import { env } from '@marketforge/config';
import { SignJWT } from 'jose';

/**
 * Mint a MarketForge HS256 JWT. Self-contained: carries the tenant (`org_id`)
 * and `role` so verification (packages/auth JwtAuthProvider) needs no lookup.
 */
export interface SignTokenInput {
  userId: string;
  email: string;
  name?: string;
  orgId: string;
  role: string;
}

function secretKey(): Uint8Array {
  if (!env.AUTH_JWT_SECRET) {
    throw new Error('AUTH_JWT_SECRET is not configured');
  }
  return new TextEncoder().encode(env.AUTH_JWT_SECRET);
}

export async function signToken(input: SignTokenInput): Promise<string> {
  return new SignJWT({
    email: input.email,
    ...(input.name ? { name: input.name } : {}),
    org_id: input.orgId,
    role: input.role,
  })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(input.userId)
    .setIssuedAt()
    .setExpirationTime(env.AUTH_JWT_EXPIRES_IN)
    .sign(secretKey());
}
