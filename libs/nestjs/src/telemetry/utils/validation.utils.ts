import { TelemetryModuleOptions } from '../telemetry.types';

/**
 * Validate telemetry module options
 */
export function validateTelemetryOptions(options: TelemetryModuleOptions): void {
  // Validate sampler ratio if it's a number
  if (options.tracing?.sampler && typeof options.tracing.sampler === 'number') {
    if (options.tracing.sampler < 0 || options.tracing.sampler > 1) {
      throw new Error('Tracing sampler ratio must be between 0 and 1');
    }
  }

  // Validate exporter endpoints
  if (options.tracing?.exporter?.endpoint) {
    try {
      new URL(options.tracing.exporter.endpoint);
    } catch {
      throw new Error(`Invalid tracing exporter endpoint: ${options.tracing.exporter.endpoint}`);
    }
  }

  if (options.metrics?.exporter?.endpoint) {
    try {
      new URL(options.metrics.exporter.endpoint);
    } catch {
      throw new Error(`Invalid metrics exporter endpoint: ${options.metrics.exporter.endpoint}`);
    }
  }

  if (options.logs?.exporter?.endpoint) {
    try {
      new URL(options.logs.exporter.endpoint);
    } catch {
      throw new Error(`Invalid logs exporter endpoint: ${options.logs.exporter.endpoint}`);
    }
  }

  // Validate Prometheus port
  if (options.metrics?.exporter?.type === 'prometheus') {
    const port = options.metrics.exporter.port || 9464;
    if (port < 1 || port > 65535) {
      throw new Error(`Invalid Prometheus port: ${port}. Must be between 1 and 65535`);
    }
  }
}
