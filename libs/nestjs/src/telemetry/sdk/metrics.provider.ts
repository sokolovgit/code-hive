import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { Resource } from '@opentelemetry/resources';
import {
  MeterProvider,
  PeriodicExportingMetricReader,
  ConsoleMetricExporter,
  PushMetricExporter,
} from '@opentelemetry/sdk-metrics';

import { createOTLPMetricExporter } from '../exporters';
import { createPrometheusExporter } from '../exporters';

export interface MetricsProviderOptions {
  resource: Resource;
  enabled?: boolean;
  exporter?: {
    type?: 'otlp' | 'prometheus' | 'console';
    endpoint?: string;
    protocol?: 'grpc' | 'http';
    headers?: Record<string, string>;
    port?: number; // For Prometheus
  };
  exportIntervalMillis?: number;
  exportTimeoutMillis?: number;
  attributes?: Record<string, string | number | boolean>;
}

/**
 * Creates and configures a MeterProvider
 */
export function createMetricsProvider(options: MetricsProviderOptions): MeterProvider | null {
  const {
    resource,
    enabled = true,
    exporter,
    exportIntervalMillis = 60000, // 60 seconds - must be >= exportTimeoutMillis
    exportTimeoutMillis = 30000, // 30 seconds
    attributes: _attributes = {}, // eslint-disable-line @typescript-eslint/no-unused-vars
  } = options;

  if (!enabled) {
    return null;
  }

  // Create exporter
  let metricExporter: PushMetricExporter;
  let metricReader: PeriodicExportingMetricReader | PrometheusExporter;

  if (exporter?.type === 'prometheus') {
    // PrometheusExporter is both a MetricReader and exposes HTTP endpoint
    metricReader = createPrometheusExporter({
      port: exporter.port,
    });
  } else if (exporter?.type === 'console' || !exporter?.type) {
    metricExporter = new ConsoleMetricExporter();
    metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis,
      exportTimeoutMillis,
    });
  } else {
    // OTLP exporter
    const otlpExporter = createOTLPMetricExporter({
      endpoint: exporter.endpoint,
      protocol: exporter.protocol,
      headers: exporter.headers,
    });
    metricExporter = otlpExporter as unknown as PushMetricExporter;
    metricReader = new PeriodicExportingMetricReader({
      exporter: metricExporter,
      exportIntervalMillis,
      exportTimeoutMillis,
    });
  }

  // Create meter provider
  const meterProvider = new MeterProvider({
    resource,
    readers: [metricReader],
  });

  return meterProvider;
}
