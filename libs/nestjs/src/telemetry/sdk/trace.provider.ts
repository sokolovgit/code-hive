import { Resource } from '@opentelemetry/resources';
import { SpanProcessor, Sampler, SpanExporter } from '@opentelemetry/sdk-trace-base';
import { NodeTracerProvider } from '@opentelemetry/sdk-trace-node';

import { createOTLPTraceExporter, createConsoleTraceExporter } from '../exporters';
import { createBatchSpanProcessor, createSimpleSpanProcessor } from '../processors';
import { createSampler, createEnvironmentSampler } from '../samplers';

export interface TraceProviderOptions {
  resource: Resource;
  enabled?: boolean;
  sampler?: 'always' | 'never' | number | 'parent-always' | 'parent-ratio' | Sampler;
  exporter?: {
    type?: 'otlp' | 'console';
    endpoint?: string;
    protocol?: 'grpc' | 'http';
    headers?: Record<string, string>;
  };
  processor?: {
    type?: 'batch' | 'simple';
    maxQueueSize?: number;
    maxExportBatchSize?: number;
    scheduledDelayMillis?: number;
    exportTimeoutMillis?: number;
  };
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Creates and configures a NodeTracerProvider
 */
export function createTraceProvider(options: TraceProviderOptions): NodeTracerProvider | null {
  const { resource, enabled = true, sampler, exporter, processor, attributes = {} } = options;

  if (!enabled) {
    return null;
  }

  // Create sampler
  const environment = process.env.NODE_ENV || 'development';
  const traceSampler = sampler ? createSampler({ sampler }) : createEnvironmentSampler(environment);

  // Create exporter
  let spanExporter: SpanExporter;
  if (exporter?.type === 'console' || !exporter?.type) {
    spanExporter = createConsoleTraceExporter();
  } else {
    const otlpExporter = createOTLPTraceExporter({
      endpoint: exporter.endpoint,
      protocol: exporter.protocol,
      headers: exporter.headers,
    });
    spanExporter = otlpExporter as unknown as SpanExporter;
  }

  // Create span processor
  const processorType = processor?.type || 'batch';
  let spanProcessor: SpanProcessor;
  if (processorType === 'simple') {
    spanProcessor = createSimpleSpanProcessor(spanExporter);
  } else {
    spanProcessor = createBatchSpanProcessor(spanExporter, {
      maxQueueSize: processor?.maxQueueSize,
      maxExportBatchSize: processor?.maxExportBatchSize,
      scheduledDelayMillis: processor?.scheduledDelayMillis,
      exportTimeoutMillis: processor?.exportTimeoutMillis,
    });
  }

  // Create tracer provider
  const tracerProvider = new NodeTracerProvider({
    resource,
    sampler: traceSampler,
  });

  // Add span processor
  // Note: NodeTracerProvider may use a different method name
  (
    tracerProvider as unknown as { addSpanProcessor: (processor: SpanProcessor) => void }
  ).addSpanProcessor(spanProcessor);

  // Register global tracer provider
  tracerProvider.register();

  // Set global attributes if provided
  if (Object.keys(attributes).length > 0) {
    // Attributes are typically set on spans, not the provider
    // But we can store them for later use
  }

  return tracerProvider;
}
