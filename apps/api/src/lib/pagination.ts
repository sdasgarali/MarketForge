import { z } from 'zod';

/** Query schema for list endpoints — bounded to protect the DB. */
export const PaginationQuery = z.object({
  limit: z.coerce.number().int().positive().max(100).default(25),
  offset: z.coerce.number().int().nonnegative().default(0),
});
export type PaginationQuery = z.infer<typeof PaginationQuery>;

/** Build the standard list envelope (mirrors contracts `paginated`). */
export function paginate<T>(items: T[], total: number, page: PaginationQuery) {
  return { items, total, limit: page.limit, offset: page.offset };
}
