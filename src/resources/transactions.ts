/**
 * Transactions resource: `GET /api/v1/transactions` (list) and
 * `GET /api/v1/transactions/{id}` (detail).
 *
 * `iterAll` is an async generator that walks every page until exhaustion.
 * The server's `count` is the *current page length*, not the total — so
 * the iterator detects exhaustion via `hasMore` (partial last page), not
 * by reading `count`.
 */

import type {
  Transaction,
  TransactionListFilters,
  TransactionPage,
} from "../models/transaction.js";
import {
  TransactionPageSchema,
  TransactionSchema,
  toTransactionListQuery,
} from "../models/transaction.js";
import { Resource, parseResponse } from "./_base.js";

export class TransactionsResource extends Resource {
  /** Fetch a single page of transactions. */
  async list(filters: TransactionListFilters = {}): Promise<TransactionPage> {
    const data = await this.transport.request("GET", "transactions", {
      params: toTransactionListQuery(filters),
    });
    return parseResponse(TransactionPageSchema, data);
  }

  /** Fetch a transaction by its UUID or by its consumer-supplied `order_id`. */
  async get(idOrOrderId: string): Promise<Transaction> {
    const data = await this.transport.request(
      "GET",
      `transactions/${encodeURIComponent(idOrOrderId)}`,
    );
    return parseResponse(TransactionSchema, data);
  }

  /**
   * Yield every transaction matching `filters` across all pages.
   *
   * Usage:
   * ```ts
   * for await (const tx of client.transactions.iterAll({ status: "succeeded" })) {
   *   console.log(tx.orderId);
   * }
   * ```
   */
  async *iterAll(filters: TransactionListFilters = {}): AsyncGenerator<Transaction, void, void> {
    let page = filters.page ?? 1;
    while (true) {
      const current = await this.list({ ...filters, page });
      for (const tx of current.results) {
        yield tx;
      }
      if (!current.hasMore) return;
      page += 1;
    }
  }
}
