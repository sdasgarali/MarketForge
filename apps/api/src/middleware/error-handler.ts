/**
 * Centralized error handler. Maps AppError, @marketforge/auth errors
 * (Unauthorized/Forbidden), and ZodError to a stable problem+json body. Anything
 * else becomes an opaque 500 — internals are logged, never leaked to the client.
 */
import type { ErrorRequestHandler } from 'express';
import { ZodError } from 'zod';
import { ForbiddenError, UnauthorizedError } from '@marketforge/auth';
import { createLogger } from '@marketforge/logger';
import { AppError, type ProblemBody } from '../http/errors.js';

const log = createLogger({ service: 'api', workflow: 'error-handler' });

interface Mapped {
  status: number;
  code: string;
  message: string;
  details?: unknown;
}

function mapError(err: unknown): Mapped {
  if (err instanceof AppError) {
    return { status: err.statusCode, code: err.code, message: err.message, details: err.details };
  }
  if (err instanceof ZodError) {
    return {
      status: 400,
      code: 'bad_request',
      message: 'Validation failed',
      details: err.flatten(),
    };
  }
  if (err instanceof UnauthorizedError) {
    return { status: 401, code: 'unauthorized', message: err.message };
  }
  if (err instanceof ForbiddenError) {
    return { status: 403, code: 'forbidden', message: err.message };
  }
  // Some errors (auth pkg future variants) expose a numeric statusCode.
  const maybe = err as { statusCode?: unknown; message?: unknown };
  if (typeof maybe?.statusCode === 'number') {
    return {
      status: maybe.statusCode,
      code: 'error',
      message: typeof maybe.message === 'string' ? maybe.message : 'Error',
    };
  }
  return { status: 500, code: 'internal_error', message: 'Internal server error' };
}

// Express requires the 4-arg signature to recognize this as an error handler
// (the unused `next` param must remain for Express to detect it).
export const errorHandler: ErrorRequestHandler = (err, req, res, _next) => {
  const mapped = mapError(err);

  // 5xx are unexpected — log full error; 4xx are client faults — log at warn.
  if (mapped.status >= 500) {
    log.error({ err, request_id: req.id, path: req.path, method: req.method }, 'request failed');
  } else {
    log.warn(
      { request_id: req.id, path: req.path, method: req.method, code: mapped.code },
      mapped.message,
    );
  }

  const body: ProblemBody = {
    error: {
      code: mapped.code,
      message: mapped.message,
      request_id: String(req.id),
    },
  };
  if (mapped.details !== undefined) body.error.details = mapped.details;

  res.status(mapped.status).json(body);
};
