import { OTLPTraceExporter } from '@opentelemetry/exporter-otlp-grpc';
import { OTLPMetricExporter } from '@opentelemetry/exporter-otlp-grpc';
import { OTLPTraceExporter as OTLPTraceExporterHttp } from '@opentelemetry/exporter-otlp-http';
import { OTLPMetricExporter as OTLPMetricExporterHttp } from '@opentelemetry/exporter-otlp-http';

export interface OTLPExporterOptions {
  endpoint?: string;
  protocol?: 'grpc' | 'http';
  headers?: Record<string, string>;
  timeoutMillis?: number;
  compression?: 'gzip' | 'none';
}

/**
 * Get OTLP endpoint from environment variables
 * Checks OTLP_URL
 */
function getOTLPEndpoint(defaultEndpoint: string = 'http://localhost:4317'): string {
  return process.env.OTLP_URL || defaultEndpoint;
}

/**
 * Creates an OTLP trace exporter
 */
export function createOTLPTraceExporter(
  options: OTLPExporterOptions = {}
): OTLPTraceExporter | OTLPTraceExporterHttp {
  const {
    endpoint = getOTLPEndpoint(),
    protocol = 'grpc',
    headers,
    timeoutMillis,
    compression,
  } = options;

  // For gRPC, remove http:// or https:// prefix if present
  // OTLP gRPC exporters expect just host:port
  let finalEndpoint = endpoint;
  if (protocol === 'grpc') {
    finalEndpoint = endpoint.replace(/^https?:\/\//, '');
  }

  const baseConfig: {
    url: string;
    headers?: Record<string, string>;
    timeoutMillis?: number;
  } = {
    url: finalEndpoint,
    headers,
    timeoutMillis,
  };

  // Only add compression if it's gzip (the only supported value)
  if (compression === 'gzip') {
    (baseConfig as { compression?: 'gzip' }).compression = 'gzip';
  }

  if (protocol === 'grpc') {
    return new OTLPTraceExporter(baseConfig);
  } else {
    return new OTLPTraceExporterHttp(baseConfig);
  }
}

/**
 * Creates an OTLP metrics exporter
 */
export function createOTLPMetricExporter(
  options: OTLPExporterOptions = {}
): OTLPMetricExporter | OTLPMetricExporterHttp {
  const {
    endpoint = getOTLPEndpoint(),
    protocol = 'grpc',
    headers,
    timeoutMillis,
    compression,
  } = options;

  // For gRPC, remove http:// or https:// prefix if present
  // OTLP gRPC exporters expect just host:port
  let finalEndpoint = endpoint;
  if (protocol === 'grpc') {
    finalEndpoint = endpoint.replace(/^https?:\/\//, '');
  }

  const baseConfig: {
    url: string;
    headers?: Record<string, string>;
    timeoutMillis?: number;
  } = {
    url: finalEndpoint,
    headers,
    timeoutMillis,
  };

  // Only add compression if it's gzip (the only supported value)
  if (compression === 'gzip') {
    (baseConfig as { compression?: 'gzip' }).compression = 'gzip';
  }

  if (protocol === 'grpc') {
    return new OTLPMetricExporter(baseConfig);
  } else {
    return new OTLPMetricExporterHttp(baseConfig);
  }
}

/**
 * Creates an OTLP logs exporter
 * Note: Logs API support may vary by OpenTelemetry version
 */
export function createOTLPLogExporter(_options: OTLPExporterOptions = {}): unknown {
  // Logs exporter implementation depends on OpenTelemetry version
  // For now, return null as logs API may not be available
  return null;
}
