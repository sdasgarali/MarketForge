import { z } from 'zod';

/** Shared scalar/primitive schemas reused across DTOs. */
export const Uuid = z.string().uuid();
export type Uuid = z.infer<typeof Uuid>;

export const IsoDateTime = z
  .union([z.string().datetime({ offset: true }), z.date()])
  .transform((v) => (v instanceof Date ? v.toISOString() : v));
export type IsoDateTime = z.infer<typeof IsoDateTime>;

/** Standard audit timestamps present on most persisted entities. */
export const Timestamps = z.object({
  created_at: z.string().datetime({ offset: true }),
  updated_at: z.string().datetime({ offset: true }).optional(),
});
export type Timestamps = z.infer<typeof Timestamps>;

/** Every tenant-scoped entity carries org_id (RLS, ADR-001). */
export const TenantScoped = z.object({
  org_id: Uuid,
});
export type TenantScoped = z.infer<typeof TenantScoped>;

/** IANA timezone string (e.g. 'Asia/Karachi'). Validated loosely. */
export const Timezone = z.string().min(1);
export type Timezone = z.infer<typeof Timezone>;

/** Generic JSON value schema for `jsonb` columns. */
export type Json = string | number | boolean | null | { [k: string]: Json } | Json[];
export const Json: z.ZodType<Json> = z.lazy(() =>
  z.union([
    z.string(),
    z.number(),
    z.boolean(),
    z.null(),
    z.array(Json),
    z.record(Json),
  ]),
);

/** Standard paginated list envelope for API responses. */
export const paginated = <T extends z.ZodTypeAny>(item: T) =>
  z.object({
    items: z.array(item),
    total: z.number().int().nonnegative(),
    limit: z.number().int().positive(),
    offset: z.number().int().nonnegative(),
  });

/** AI token/cost usage returned by LLM/image/video adapters. */
export const Usage = z.object({
  tokens_in: z.number().int().nonnegative().default(0),
  tokens_out: z.number().int().nonnegative().default(0),
  cost_usd: z.number().nonnegative().default(0),
  latency_ms: z.number().nonnegative().default(0),
  model: z.string(),
  provider: z.string().optional(),
});
export type Usage = z.infer<typeof Usage>;
