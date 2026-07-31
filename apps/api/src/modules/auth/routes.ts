/**
 * Manual auth: email/password registration + login, issuing MarketForge JWTs.
 * PUBLIC — mounted before the authContext middleware. Users/credentials live in
 * MongoDB; each user is scoped to AUTH_DEFAULT_ORG_ID for Postgres RLS.
 */
import { Router } from 'express';
import { z } from 'zod';
import { AppError, ConflictError } from '../../http/errors.js';
import { asyncHandler } from '../../lib/async-handler.js';
import { signToken } from '../../lib/jwt-sign.js';
import { type UserDoc, usersCollection } from '../../lib/mongo.js';
import { hashPassword, verifyPassword } from '../../lib/password.js';
import { parseOrThrow } from '../../lib/validate.js';
import { provisionTenant } from './tenant.js';

export const authRouter: Router = Router();

const RegisterInput = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  name: z.string().min(1).max(120).optional(),
});

const LoginInput = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

function publicUser(id: string, u: Pick<UserDoc, 'email' | 'name' | 'orgId' | 'role'>) {
  return {
    id,
    email: u.email,
    name: u.name ?? null,
    org_id: u.orgId,
    role: u.role,
  };
}

authRouter.post(
  '/register',
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(RegisterInput, req.body);
    const email = input.email.toLowerCase();
    const users = await usersCollection();

    if (await users.findOne({ email })) {
      throw new ConflictError('An account with this email already exists');
    }

    // Multi-tenant: every signup gets its OWN organization (isolated by RLS).
    const tenant = await provisionTenant({ email, name: input.name });

    const doc: UserDoc = {
      email,
      passwordHash: hashPassword(input.password),
      ...(input.name ? { name: input.name } : {}),
      orgId: tenant.orgId,
      pgUserId: tenant.userId,
      role: 'admin',
      createdAt: new Date(),
    };
    await users.insertOne(doc);

    // JWT subject is the Postgres user id (FK-safe identity).
    const token = await signToken({
      userId: tenant.userId,
      email,
      ...(input.name ? { name: input.name } : {}),
      orgId: doc.orgId,
      role: doc.role,
    });
    res.status(201).json({ token, user: publicUser(tenant.userId, doc) });
  }),
);

authRouter.post(
  '/login',
  asyncHandler(async (req, res) => {
    const input = parseOrThrow(LoginInput, req.body);
    const email = input.email.toLowerCase();
    const users = await usersCollection();

    const user = await users.findOne({ email });
    if (!user || !verifyPassword(input.password, user.passwordHash)) {
      // Same message for both cases — don't leak which emails exist.
      throw new AppError(401, 'unauthorized', 'Invalid email or password');
    }

    await users.updateOne({ _id: user._id }, { $set: { lastLoginAt: new Date() } });

    // Prefer the Postgres user id (FK-safe); fall back to the Mongo id for
    // accounts created before multi-tenant provisioning.
    const subject = user.pgUserId ?? user._id.toString();
    const token = await signToken({
      userId: subject,
      email: user.email,
      ...(user.name ? { name: user.name } : {}),
      orgId: user.orgId,
      role: user.role,
    });
    res.json({ token, user: publicUser(subject, user) });
  }),
);
