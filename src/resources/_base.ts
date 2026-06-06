/**
 * Shared infrastructure for resource classes.
 *
 * Each resource holds a single {@link Transport} reference (no resource owns
 * its own `fetch`). `parseResponse` wraps Zod's `ZodError` as a
 * {@link PSIPProtocolError} so every server-contract failure collapses into
 * the SDK's exception hierarchy — consumers can catch a single
 * `PSIPError` root.
 *
 * Note: `ZodError` raised while *building* a request (e.g. invalid input to
 * a `to*WireBody` helper) is **not** wrapped — that's a caller bug, and the
 * user benefits from Zod's detailed error message.
 */

import type { ZodTypeAny, z } from "zod";
import { ZodError } from "zod";
import { PSIPProtocolError } from "../exceptions.js";
import type { Transport } from "../transport.js";

export class Resource {
  protected readonly transport: Transport;

  constructor(transport: Transport) {
    this.transport = transport;
  }
}

export function parseResponse<S extends ZodTypeAny>(schema: S, data: unknown): z.infer<S> {
  try {
    return schema.parse(data) as z.infer<S>;
  } catch (err) {
    if (err instanceof ZodError) {
      throw new PSIPProtocolError(`server response did not match expected shape: ${err.message}`, {
        cause: err,
      });
    }
    /* c8 ignore next 2 */
    throw err;
  }
}
