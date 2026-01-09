import { TextMapPropagator } from '@opentelemetry/api';
import { Instrumentation } from '@opentelemetry/instrumentation';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { SpanExporter } from '@opentelemetry/sdk-trace-base';

import { createOTLPTraceExporter, createConsoleTraceExporter } from '../exporters';
import { createPropagators } from '../propagators';
import { createSampler, createEnvironmentSampler } from '../samplers';

import { createLogsProvider, LogsProviderOptions } from './logs.provider';
import { createMetricsProvider, MetricsProviderOptions } from './metrics.provider';
import { createResource, ResourceFactoryOptions } from './resource.factory';
import { TraceProviderOptions } from './trace.provider';

export interface SDKFactoryOptions {
  enabled?: boolean;
  serviceName?: string;
  serviceVersion?: string;
  environment?: string;
  serviceInstanceId?: string;
  resource?: ResourceFactoryOptions;
  tracing?: TraceProviderOptions['enabled'] extends false
    ? { enabled: false }
    : Omit<TraceProviderOptions, 'resource' | 'enabled'> & { enabled?: boolean };
  metrics?: MetricsProviderOptions['enabled'] extends false
    ? { enabled: false }
    : Omit<MetricsProviderOptions, 'resource' | 'enabled'> & { enabled?: boolean };
  logs?: LogsProviderOptions['enabled'] extends false
    ? { enabled: false }
    : Omit<LogsProviderOptions, 'resource' | 'enabled'> & { enabled?: boolean };
  instrumentations?: Instrumentation[];
  propagators?: TextMapPropagator[];
}

/**
 * Creates and configures an OpenTelemetry NodeSDK instance
 */
export function createSDK(options: SDKFactoryOptions = {}): NodeSDK | null {
  const {
    enabled = true,
    serviceName,
    serviceVersion,
    environment,
    serviceInstanceId,
    resource: resourceOptions = {},
    tracing = {},
    metrics = {},
    logs = {},
    instrumentations = [],
    propagators,
  } = options;

  // Check if telemetry is disabled
  if (enabled === false) {
    return null;
  }

  // Create resource
  const resource = createResource({
    serviceName,
    serviceVersion,
    environment,
    serviceInstanceId,
    ...resourceOptions,
  });

  // Create trace exporter and sampler for NodeSDK
  let traceExporter: SpanExporter | undefined;
  let traceSampler;

  if (tracing.enabled !== false) {
    const env = process.env.NODE_ENV || 'development';
    traceSampler = tracing.sampler
      ? createSampler({ sampler: tracing.sampler })
      : createEnvironmentSampler(env);

    if (tracing.exporter?.type === 'console' || !tracing.exporter?.type) {
      traceExporter = createConsoleTraceExporter();
    } else {
      traceExporter = createOTLPTraceExporter({
        endpoint: tracing.exporter.endpoint,
        protocol: tracing.exporter.protocol,
        headers: tracing.exporter.headers,
      }) as unknown as SpanExporter;
    }
  }

  // Create metrics provider (for now, keep the existing approach)
  createMetricsProvider({
    resource,
    enabled: metrics.enabled !== false,
    exporter: metrics.exporter,
    exportIntervalMillis: metrics.exportIntervalMillis,
    exportTimeoutMillis: metrics.exportTimeoutMillis,
    attributes: metrics.attributes,
  });

  // Create logs provider
  createLogsProvider({
    resource,
    enabled: logs.enabled !== false,
    exporter: logs.exporter,
    processor: logs.processor,
    attributes: logs.attributes,
  });

  // Create propagators
  const contextPropagators = propagators || createPropagators(['tracecontext', 'baggage']);

  // Create SDK with trace exporter directly
  // NodeSDK will create and register the provider internally with a BatchSpanProcessor
  // Note: Custom span processor options are not directly supported by NodeSDK's traceExporter option,
  // but the default BatchSpanProcessor should work for most cases
  const sdk = new NodeSDK({
    resource,
    traceExporter: traceExporter,
    sampler: traceSampler,
    instrumentations,
    textMapPropagator: contextPropagators.length === 1 ? contextPropagators[0] : undefined, // NodeSDK only supports single propagator, use composite if needed
  });

  return sdk;
}

/**
 * Starts the SDK and returns it
 */
export function startSDK(options: SDKFactoryOptions = {}): NodeSDK | null {
  const sdk = createSDK(options);
  if (sdk) {
    try {
      sdk.start();
      return sdk;
    } catch (error) {
      console.error('Failed to start OpenTelemetry SDK:', error);
      return null;
    }
  }
  return null;
}
