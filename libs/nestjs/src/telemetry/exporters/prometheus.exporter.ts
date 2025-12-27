import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';

export interface PrometheusExporterOptions {
  port?: number;
  endpoint?: string;
  prefix?: string;
  appendTimestamp?: boolean;
}

/**
 * Creates a Prometheus metrics exporter
 * This exporter exposes metrics via HTTP endpoint for Prometheus to scrape
 */
export function createPrometheusExporter(
  options: PrometheusExporterOptions = {}
): PrometheusExporter {
  const { port = 9464, endpoint = '/metrics', prefix = '', appendTimestamp = true } = options;

  return new PrometheusExporter({ port, endpoint, prefix, appendTimestamp });
}
