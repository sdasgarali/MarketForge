import { randomUUID } from 'node:crypto';
import type { RequestHandler } from 'express';

/**
 * Assigns a correlation id to every request. Honors an inbound `x-request-id`
 * (trusted upstream proxy) or generates a UUID. Echoed back in the response
 * header and used by pino-http + the error handler for traceability.
 */
export const requestId: RequestHandler = (req, res, next) => {
  const inbound = req.headers['x-request-id'];
  const id = (Array.isArray(inbound) ? inbound[0] : inbound)?.trim() || randomUUID();
  req.id = id;
  res.setHeader('x-request-id', id);
  next();
};
