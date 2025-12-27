import { ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { ConsoleSpanExporter } from '@opentelemetry/sdk-trace-base';

/**
 * Creates a console trace exporter for development/debugging
 */
export function createConsoleTraceExporter(): ConsoleSpanExporter {
  return new ConsoleSpanExporter();
}

/**
 * Creates a console metrics exporter for development/debugging
 */
export function createConsoleMetricExporter(): ConsoleMetricExporter {
  return new ConsoleMetricExporter();
}

/**
 * Creates a console logs exporter for development/debugging
 * Note: Logs API support may vary by OpenTelemetry version
 */
export function createConsoleLogExporter(): null {
  // Logs exporter implementation depends on OpenTelemetry version
  return null;
}
