/**
 * Payments resource: `POST /api/v1/payment`, `POST /api/v1/repayment`,
 * `POST /api/v1/checkout-sessions/.../verify`, and
 * `POST /api/v1/transactions/{id}/refund`.
 */

import type {
  CheckoutSessionVerifyResponse,
  PaymentCreateInput,
  PaymentCreateResponse,
  RefundInput,
  RefundResponse,
  RepaymentInput,
} from "../models/payment.js";
import {
  CheckoutSessionVerifyResponseSchema,
  PaymentCreateResponseSchema,
  RefundResponseSchema,
  toPaymentCreateWireBody,
  toRefundWireBody,
  toRepaymentWireBody,
} from "../models/payment.js";
import { Resource, parseResponse } from "./_base.js";

export class PaymentsResource extends Resource {
  /**
   * Create a Checkout session for a new order. Returns the hosted
   * `paymentUrl` the consumer redirects the buyer to.
   */
  async create(input: PaymentCreateInput): Promise<PaymentCreateResponse> {
    const data = await this.transport.request("POST", "payment", {
      json: toPaymentCreateWireBody(input),
    });
    return parseResponse(PaymentCreateResponseSchema, data);
  }

  /**
   * Re-issue a Checkout session for an existing order whose previous
   * attempt failed or expired. The server reuses the original webhook URLs
   * and `sandbox` flag unless overridden here.
   */
  async recreate(input: RepaymentInput): Promise<PaymentCreateResponse> {
    const data = await this.transport.request("POST", "repayment", {
      json: toRepaymentWireBody(input),
    });
    return parseResponse(PaymentCreateResponseSchema, data);
  }

  /**
   * Retrieve a Checkout Session live from Stripe and apply its completion
   * to the local Transaction. Idempotent — safe to call repeatedly from a
   * "check again" UI when you can't rely on the webhook fan-out.
   *
   * `paymentStatus` mirrors Stripe — typically `paid` / `unpaid` /
   * `no_payment_required`. Only `paid` populates `transactionId`.
   */
  async verifySession(sessionId: string): Promise<CheckoutSessionVerifyResponse> {
    const data = await this.transport.request(
      "POST",
      `checkout-sessions/${encodeURIComponent(sessionId)}/verify`,
    );
    return parseResponse(CheckoutSessionVerifyResponseSchema, data);
  }

  /**
   * Refund all or part of a settled transaction via Stripe.
   *
   * Pass `transactionId` (the payment-system Transaction UUID). Omit
   * `amount` for a full refund. The gateway calls Stripe's Refund API by
   * `payment_intent` id (resolved server-side from the Transaction row) and
   * returns the new Refund object's id + status. Stripe fires
   * `charge.refunded` asynchronously, which the gateway fans out to
   * subscribers as `payment.refunded` — clients that subscribe receive
   * that event regardless of which path triggered the refund.
   */
  async refund(transactionId: string, input: RefundInput = {}): Promise<RefundResponse> {
    const data = await this.transport.request(
      "POST",
      `transactions/${encodeURIComponent(transactionId)}/refund`,
      { json: toRefundWireBody(input) },
    );
    return parseResponse(RefundResponseSchema, data);
  }
}
