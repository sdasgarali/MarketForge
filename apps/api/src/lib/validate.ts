import type { z } from 'zod';
import { BadRequestError } from '../http/errors.js';

/**
 * Parse `data` with a Zod schema, converting a ZodError into a 400 BadRequest
 * carrying flattened, caller-safe field issues. Returns the typed, parsed value
 * (with schema defaults applied).
 */
export function parseOrThrow<S extends z.ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new BadRequestError('Validation failed', result.error.flatten());
  }
  return result.data;
}
