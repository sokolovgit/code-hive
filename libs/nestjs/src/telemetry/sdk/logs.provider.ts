import { Resource } from '@opentelemetry/resources';
import {
  LoggerProvider,
  SimpleLogRecordProcessor,
  BatchLogRecordProcessor,
  LogRecordExporter,
} from '@opentelemetry/sdk-logs';

import { createOTLPLogExporter, createConsoleLogExporter } from '../exporters';

export interface LogsProviderOptions {
  resource: Resource;
  enabled?: boolean;
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
 * Creates and configures a LoggerProvider
 */
export function createLogsProvider(options: LogsProviderOptions): LoggerProvider | null {
  const {
    resource,
    enabled = true,
    exporter,
    processor,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    attributes: _attributes = {},
  } = options;

  if (!enabled) {
    return null;
  }

  // Create exporter
  let logExporter: LogRecordExporter | null = null;
  if (exporter?.type === 'console' || !exporter?.type) {
    const consoleExporter = createConsoleLogExporter();
    if (consoleExporter) {
      logExporter = consoleExporter as LogRecordExporter;
    }
  } else {
    const otlpExporter = createOTLPLogExporter({
      endpoint: exporter.endpoint,
      protocol: exporter.protocol,
      headers: exporter.headers,
    });
    if (otlpExporter) {
      logExporter = otlpExporter as LogRecordExporter;
    }
  }

  if (!logExporter) {
    return null;
  }

  // Create log record processor
  const processorType = processor?.type || 'batch';
  let logRecordProcessor: SimpleLogRecordProcessor | BatchLogRecordProcessor;

  if (processorType === 'simple') {
    logRecordProcessor = new SimpleLogRecordProcessor(logExporter);
  } else {
    logRecordProcessor = new BatchLogRecordProcessor(logExporter, {
      maxQueueSize: processor?.maxQueueSize || 2048,
      maxExportBatchSize: processor?.maxExportBatchSize || 512,
      scheduledDelayMillis: processor?.scheduledDelayMillis || 5000,
      exportTimeoutMillis: processor?.exportTimeoutMillis || 30000,
    });
  }

  // Create logger provider with processors (v2 API)
  const loggerProvider = new LoggerProvider({
    resource,
    processors: [logRecordProcessor],
  });

  return loggerProvider;
}
