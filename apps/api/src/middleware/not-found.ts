import type { RequestHandler } from 'express';
import { NotFoundError } from '../http/errors.js';

/** Terminal 404 for unmatched routes — forwarded to the error handler. */
export const notFound: RequestHandler = (req, _res, next) => {
  next(new NotFoundError(`Route not found: ${req.method} ${req.path}`));
};
