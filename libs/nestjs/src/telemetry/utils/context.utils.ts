import { context, trace } from '@opentelemetry/api';
import { ClsService } from 'nestjs-cls';

/**
 * Get trace context from CLS if available
 */
export function getTraceContextFromCLS(cls?: ClsService): {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
} {
  if (!cls) {
    return {};
  }

  return {
    traceId: cls.get('traceId'),
    spanId: cls.get('spanId'),
    parentSpanId: cls.get('parentSpanId'),
  };
}

/**
 * Set trace context in CLS if available
 */
export function setTraceContextInCLS(
  traceId: string,
  spanId: string,
  parentSpanId?: string,
  cls?: ClsService
): void {
  if (!cls) {
    return;
  }

  cls.set('traceId', traceId);
  cls.set('spanId', spanId);
  if (parentSpanId) {
    cls.set('parentSpanId', parentSpanId);
  }
}

/**
 * Run a function within an async context
 */
export async function runInContext<T>(fn: () => T | Promise<T>): Promise<T> {
  const activeSpan = trace.getActiveSpan();
  if (activeSpan) {
    const activeContext = trace.setSpan(context.active(), activeSpan);
    return context.with(activeContext, async () => {
      return await fn();
    });
  }
  return await fn();
}
