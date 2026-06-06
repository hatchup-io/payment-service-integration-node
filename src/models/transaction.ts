/**
 * Models for `GET /api/v1/transactions` (list) and
 * `GET /api/v1/transactions/{id}` (detail).
 *
 * Amounts are kept as wire-shape decimal strings (no native JS decimal).
 * Datetimes are ISO 8601 strings — consumers parse with `new Date(...)` if
 * they need a `Date` instance.
 */

import { z } from "zod";

export const TransactionStatusSchema = z.union([
  z.literal("succeeded"),
  z.literal("failed"),
  z.literal("pending"),
]);
export type TransactionStatus = z.infer<typeof TransactionStatusSchema>;

export const TransactionSchema = z
  .object({
    id: z.string().uuid(),
    order_id: z.string(),
    amount: z.union([z.string(), z.number()]).transform(String),
    currency: z.string(),
    status: TransactionStatusSchema,
    is_test: z.boolean(),
    verified_at: z.string().datetime({ offset: true }).nullable().optional(),
    created_at: z.string().datetime({ offset: true }),
    stripe_checkout_session_id: z.string().nullable().optional(),
  })
  .passthrough()
  .transform((wire) => ({
    id: wire.id,
    orderId: wire.order_id,
    amount: wire.amount,
    currency: wire.currency,
    status: wire.status,
    isTest: wire.is_test,
    verifiedAt: wire.verified_at ?? null,
    createdAt: wire.created_at,
    stripeCheckoutSessionId: wire.stripe_checkout_session_id ?? null,
  }));

export type Transaction = z.infer<typeof TransactionSchema>;

export interface TransactionListFilters {
  /** Inclusive lower bound on `created_at`. ISO date or `Date`. */
  dateFrom?: Date | string;
  /** Inclusive upper bound on `created_at`. */
  dateTo?: Date | string;
  status?: TransactionStatus;
  sandbox?: boolean;
  /** Server-side filter for transactions whose `verified_at` is set/unset. */
  verified?: boolean;
  /**
   * Server-side prefix filter on `Transaction.order_id`. SHARED-mode
   * consumers pass the project slug prefix here so the server filters
   * before responding.
   */
  orderIdStartswith?: string;
  /** 1-based page index. Defaults to 1. */
  page?: number;
  /** Items per page. Defaults to 20; max 100. */
  pageSize?: number;
}

/** Convert filters to the query-param shape the server expects. */
export function toTransactionListQuery(
  filters: TransactionListFilters = {},
): Record<string, string> {
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 20;
  if (!Number.isInteger(page) || page < 1) {
    throw new RangeError(`page must be a positive integer, got ${page}`);
  }
  if (!Number.isInteger(pageSize) || pageSize < 1 || pageSize > 100) {
    throw new RangeError(`pageSize must be between 1 and 100, got ${pageSize}`);
  }

  const params: Record<string, string> = { page: String(page), page_size: String(pageSize) };
  if (filters.dateFrom !== undefined) params.date_from = toIsoDate(filters.dateFrom);
  if (filters.dateTo !== undefined) params.date_to = toIsoDate(filters.dateTo);
  if (filters.status !== undefined) params.status = filters.status;
  if (filters.sandbox !== undefined) params.sandbox = filters.sandbox ? "true" : "false";
  if (filters.verified !== undefined) params.verified = filters.verified ? "true" : "false";
  if (filters.orderIdStartswith !== undefined)
    params.order_id_startswith = filters.orderIdStartswith;
  return params;
}

function toIsoDate(value: Date | string): string {
  if (value instanceof Date) {
    const y = value.getUTCFullYear();
    const m = String(value.getUTCMonth() + 1).padStart(2, "0");
    const d = String(value.getUTCDate()).padStart(2, "0");
    return `${y}-${m}-${d}`;
  }
  // Accept already-formatted YYYY-MM-DD; pass through verbatim.
  return value;
}

export const TransactionPageSchema = z
  .object({
    results: z.array(TransactionSchema),
    page: z.number().int(),
    page_size: z.number().int(),
    count: z.number().int(),
  })
  .passthrough()
  .transform((wire) => ({
    results: wire.results,
    page: wire.page,
    pageSize: wire.page_size,
    count: wire.count,
    /**
     * True if the current page is full and another page may exist.
     * The server's `count` is the *current page length*, not the total —
     * so consumers iterate by checking `hasMore`, not by reading `count`.
     */
    hasMore: wire.results.length >= wire.page_size,
  }));

export type TransactionPage = z.infer<typeof TransactionPageSchema>;
