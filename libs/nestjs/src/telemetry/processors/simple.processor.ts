import { SimpleSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { SpanExporter } from '@opentelemetry/sdk-trace-base';

/**
 * Creates a simple span processor
 * Exports spans immediately (useful for debugging)
 */
export function createSimpleSpanProcessor(exporter: SpanExporter): SimpleSpanProcessor {
  return new SimpleSpanProcessor(exporter);
}
