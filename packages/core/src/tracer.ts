// Lightweight OTel tracer helpers.
// @opentelemetry/api uses a global registry — no-op when no SDK is configured.

import {
  trace,
  context,
  SpanStatusCode,
  type Span,
  type Tracer,
} from "@opentelemetry/api";

export const TRACER_NAME = "@lexdiff/core";
export const TRACER_VERSION = "0.1.0";

export function getTracer(): Tracer {
  return trace.getTracer(TRACER_NAME, TRACER_VERSION);
}

/**
 * Run `fn` inside a new span. The span is set as active context so child
 * spans created by nested calls are automatically parented correctly.
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  attributes?: Record<string, string | number | boolean>,
): Promise<T> {
  const tracer = getTracer();
  const span = tracer.startSpan(name, attributes ? { attributes } : {});
  return context.with(trace.setSpan(context.active(), span), async () => {
    try {
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (err) {
      span.recordException(err as Error);
      span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
      throw err;
    } finally {
      span.end();
    }
  });
}

/**
 * Sync version — for CPU-bound work like DiffEngine.
 */
export function withSpanSync<T>(
  name: string,
  fn: (span: Span) => T,
  attributes?: Record<string, string | number | boolean>,
): T {
  const tracer = getTracer();
  const span = tracer.startSpan(name, attributes ? { attributes } : {});
  try {
    const result = fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (err) {
    span.recordException(err as Error);
    span.setStatus({ code: SpanStatusCode.ERROR, message: String(err) });
    throw err;
  } finally {
    span.end();
  }
}
