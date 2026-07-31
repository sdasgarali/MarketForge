/**
 * Express app assembly. Middleware order (per spec):
 *   request-id → pino-http → helmet → cors → rate-limit → JSON body →
 *   authContext → routes → notFound → error handler.
 *
 * Health/readiness are mounted BEFORE authContext (probes must not require auth).
 * Everything else sits behind authContext so `req.ctx` is always present.
 */
import express, { type Express } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import { pinoHttp } from 'pino-http';
import { rootLogger } from '@marketforge/logger';
import { apiConfig } from './config/index.js';
import { requestId } from './middleware/request-id.js';
import { authContext } from './middleware/auth-context.js';
import { notFound } from './middleware/not-found.js';
import { errorHandler } from './middleware/error-handler.js';
import { healthRouter } from './modules/health/routes.js';
import { authRouter } from './modules/auth/routes.js';
import { sessionRouter } from './modules/session/routes.js';
import { brandsRouter } from './modules/brands/routes.js';
import { socialAccountsRouter } from './modules/social-accounts/routes.js';
import { campaignsRouter } from './modules/campaigns/routes.js';
import { contentItemsRouter } from './modules/content-items/routes.js';
import { approvalsRouter } from './modules/approvals/routes.js';
import { promptTemplatesRouter } from './modules/prompt-templates/routes.js';
import { dashboardRouter } from './modules/dashboard/routes.js';
import { notificationsRouter } from './modules/notifications/routes.js';
import { apiKeysRouter } from './modules/api-keys/routes.js';

export function createApp(): Express {
  const app = express();

  // Behind a proxy (nginx/k8s) — trust X-Forwarded-* for correct req.ip + rate-limit keys.
  app.set('trust proxy', 1);
  app.disable('x-powered-by');

  // 1. Correlation id (before logging so it's attached to every line).
  app.use(requestId);

  // 2. Structured HTTP logging — reuse the shared pino root logger.
  app.use(
    pinoHttp({
      logger: rootLogger,
      genReqId: (req) => (req as { id?: string }).id ?? '',
      customProps: (req) => ({ request_id: (req as { id?: string }).id }),
      // Reduce noise: don't log successful health probes at info.
      autoLogging: {
        ignore: (req) => req.url === '/health' || req.url === '/ready',
      },
    }),
  );

  // 3. Security headers.
  app.use(helmet());

  // 4. CORS (explicit allowlist from config).
  app.use(
    cors({
      origin: apiConfig.corsOrigins,
      credentials: true,
      allowedHeaders: ['Content-Type', 'Authorization', 'x-org-id', 'x-request-id'],
    }),
  );

  // 5. Rate limiting (per-IP).
  app.use(
    rateLimit({
      windowMs: apiConfig.rateLimit.windowMs,
      max: apiConfig.rateLimit.max,
      standardHeaders: true,
      legacyHeaders: false,
    }),
  );

  // 6. JSON body parsing (bounded).
  app.use(express.json({ limit: apiConfig.jsonLimit }));

  // --- Public routes (no auth): liveness + readiness + auth (register/login). ---
  app.use('/', healthRouter);
  app.use('/auth', authRouter);

  // 7. Auth context — everything below requires a resolved TenantContext.
  app.use(authContext);

  // --- Authenticated, tenant-scoped, RBAC-guarded routes. ---
  app.use('/', sessionRouter);
  app.use('/brands', brandsRouter);
  // Nested social accounts under a brand.
  brandsRouter.use('/:brandId/social-accounts', socialAccountsRouter);
  app.use('/campaigns', campaignsRouter);
  app.use('/content-items', contentItemsRouter);
  app.use('/', approvalsRouter); // /approvals + /content-items/:id/(approve|reject)
  app.use('/prompt-templates', promptTemplatesRouter);
  app.use('/', dashboardRouter); // /dashboard/summary + /analytics
  app.use('/', notificationsRouter); // /notifications
  app.use('/api-keys', apiKeysRouter);

  // 8. 404 + centralized error handler (last).
  app.use(notFound);
  app.use(errorHandler);

  return app;
}
