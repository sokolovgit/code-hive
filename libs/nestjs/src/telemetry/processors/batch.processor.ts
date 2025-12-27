import { SpanExporter } from '@opentelemetry/sdk-trace-base';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-node';

export interface BatchProcessorOptions {
  maxQueueSize?: number;
  maxExportBatchSize?: number;
  scheduledDelayMillis?: number;
  exportTimeoutMillis?: number;
}

/**
 * Creates a batch span processor
 * Batches spans before exporting for better performance
 */
export function createBatchSpanProcessor(
  exporter: SpanExporter,
  options: BatchProcessorOptions = {}
): BatchSpanProcessor {
  const {
    maxQueueSize = 2048,
    maxExportBatchSize = 512,
    scheduledDelayMillis = 5000,
    exportTimeoutMillis = 30000,
  } = options;

  return new BatchSpanProcessor(exporter, {
    maxQueueSize,
    maxExportBatchSize,
    scheduledDelayMillis,
    exportTimeoutMillis,
  });
}
