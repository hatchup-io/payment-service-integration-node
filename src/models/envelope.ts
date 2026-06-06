/**
 * Generic response envelope.
 *
 * Every Hatchup Payment Service response is wrapped in
 * `{data, status, message}`. The {@link Transport} class unwraps this
 * envelope before resources see anything, so `ApiEnvelopeSchema` is **not**
 * load-bearing at runtime — it exists for documentation, for parsing
 * fixtures in tests, and for anyone reaching for a typed view of a raw
 * response (e.g. when introspecting a webhook log).
 */

import { z } from "zod";

export const ApiEnvelopeStatusSchema = z.union([z.literal("ok"), z.literal("failure")]);

export const ApiEnvelopeSchema = z
  .object({
    data: z.unknown(),
    status: ApiEnvelopeStatusSchema,
    message: z.string().default(""),
  })
  .passthrough();

export type ApiEnvelopeStatus = z.infer<typeof ApiEnvelopeStatusSchema>;
export type ApiEnvelope<T = unknown> = {
  data: T;
  status: ApiEnvelopeStatus;
  message: string;
};
