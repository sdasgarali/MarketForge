/**
 * API error taxonomy. Every AppError carries an HTTP status + machine-readable
 * `code` so the centralized error handler can emit an RFC-7807-ish problem+json
 * body without leaking internals. Auth errors (Unauthorized/Forbidden) come from
 * @marketforge/auth and already expose `statusCode` — the handler maps those too.
 */

/** Base application error. Subclasses set a concrete status + code. */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: string;
  /** Optional structured, caller-safe details (e.g. Zod field issues). */
  readonly details?: unknown;

  constructor(statusCode: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = new.target.name;
    this.statusCode = statusCode;
    this.code = code;
    if (details !== undefined) this.details = details;
    Error.captureStackTrace?.(this, new.target);
  }
}

/** 400 — malformed request the client can fix (bad body/params/query). */
export class BadRequestError extends AppError {
  constructor(message = 'Bad request', details?: unknown) {
    super(400, 'bad_request', message, details);
  }
}

/** 404 — the requested resource does not exist (or is not visible to tenant). */
export class NotFoundError extends AppError {
  constructor(message = 'Not found', details?: unknown) {
    super(404, 'not_found', message, details);
  }
}

/** 409 — state conflict (e.g. approving an item not in a reviewable state). */
export class ConflictError extends AppError {
  constructor(message = 'Conflict', details?: unknown) {
    super(409, 'conflict', message, details);
  }
}

/** 422 — semantically invalid but well-formed input. */
export class UnprocessableError extends AppError {
  constructor(message = 'Unprocessable entity', details?: unknown) {
    super(422, 'unprocessable', message, details);
  }
}

/** The JSON body shape returned for every error. */
export interface ProblemBody {
  error: {
    code: string;
    message: string;
    details?: unknown;
    request_id?: string;
  };
}
