import { TextMapPropagator } from '@opentelemetry/api';
import { Instrumentation } from '@opentelemetry/instrumentation';
import { NodeSDK } from '@opentelemetry/sdk-node';

import { createPropagators } from '../propagators';

import { createLogsProvider, LogsProviderOptions } from './logs.provider';
import { createMetricsProvider, MetricsProviderOptions } from './metrics.provider';
import { createResource, ResourceFactoryOptions } from './resource.factory';
import { createTraceProvider, TraceProviderOptions } from './trace.provider';

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

  // Create providers (they register themselves globally)
  createTraceProvider({
    resource,
    enabled: tracing.enabled !== false,
    sampler: tracing.sampler,
    exporter: tracing.exporter,
    processor: tracing.processor,
    attributes: tracing.attributes,
  });

  createMetricsProvider({
    resource,
    enabled: metrics.enabled !== false,
    exporter: metrics.exporter,
    exportIntervalMillis: metrics.exportIntervalMillis,
    exportTimeoutMillis: metrics.exportTimeoutMillis,
    attributes: metrics.attributes,
  });

  createLogsProvider({
    resource,
    enabled: logs.enabled !== false,
    exporter: logs.exporter,
    processor: logs.processor,
    attributes: logs.attributes,
  });

  // Create propagators
  const contextPropagators = propagators || createPropagators(['tracecontext', 'baggage']);

  // Create SDK
  const sdk = new NodeSDK({
    resource,
    traceExporter: undefined, // Handled by trace provider
    metricReader: undefined, // Handled by metrics provider
    instrumentations,
    textMapPropagator: contextPropagators.length === 1 ? contextPropagators[0] : undefined, // NodeSDK only supports single propagator, use composite if needed
  });

  // Note: The providers are registered automatically when created
  // The SDK will use the global providers if they're registered

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
