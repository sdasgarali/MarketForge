/**
 * Auth error taxonomy. Each carries an HTTP `statusCode` so the framework layer
 * (the API app's middleware) can translate them without re-mapping by class.
 */

/** 401 — the caller could not be authenticated (missing/invalid credentials). */
export class UnauthorizedError extends Error {
  readonly statusCode = 401;
  constructor(message = 'Unauthorized') {
    super(message);
    this.name = 'UnauthorizedError';
  }
}

/** 403 — authenticated, but not permitted (insufficient role / no active org). */
export class ForbiddenError extends Error {
  readonly statusCode = 403;
  constructor(message = 'Forbidden') {
    super(message);
    this.name = 'ForbiddenError';
  }
}
