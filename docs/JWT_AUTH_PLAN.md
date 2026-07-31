# Replace Clerk with manual JWT auth (MongoDB user store)

> User directive: drop Clerk, build email/password + JWT login, users in MongoDB Atlas.
> Pilot model: all users → seeded org `11111111-…-1111`, role `admin`. RLS scopes by org_id
> only (no write FKs on users), so users can live purely in Mongo.

## Backend (apps/api + packages/auth + packages/config)
1. config schema: `AUTH_JWT_SECRET`, `AUTH_JWT_EXPIRES_IN`(7d), `AUTH_DEFAULT_ORG_ID`(seed org),
   `AUTH_DEFAULT_ROLE`(admin), `MONGODB_URI`, `MONGODB_DB`(marketforge).
2. packages/auth: `JwtAuthProvider` (verify HS256 via `jose`); `createAuthProvider` prefers JWT
   (bypass → JWT → Clerk → throw). Add `jose` dep.
3. apps/api libs: `mongo.ts` (client + users collection), `password.ts` (node:crypto scrypt),
   `jwt-sign.ts` (jose SignJWT). Deps: `jose`, `mongodb`.
4. apps/api `modules/auth/routes.ts` (PUBLIC, before authContext): `POST /auth/register`,
   `POST /auth/login`. Returns `{ token, user }`. Zod-validated.
5. Env (local .env + VPS .env): AUTH_JWT_SECRET (gen), MONGODB_URI (atlas), MONGODB_DB.

## Frontend (apps/web) — remove Clerk
6. `lib/auth.ts`: localStorage token + `login/register/logout/getToken`.
7. api-client: attach `Authorization: Bearer <localStorage token>` (drop window.Clerk).
8. `/sign-in`, `/sign-up`: custom email/password forms → /auth/*.
9. `AuthGate`: no token → redirect /sign-in. `auth-provider`: drop ClerkProvider.
   Delete `middleware.ts`. Topbar sign-out → logout(). `env.ts`: drop clerk.
10. Vercel: Clerk env vars become unused (harmless); NEXT_PUBLIC_API_BASE_URL stays.

## Verify
- curl /auth/register + /auth/login → token; call /brands with token → Exzelon.
- Browser: sign up → dashboard loads data. Sign out → back to /sign-in.

## Secrets
- `atlas-credentials.env` + `.env` gitignored. MONGODB_URI/JWT secret only in .env (never committed).
