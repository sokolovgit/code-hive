import { Environments } from '../enums';

import type { AttributeValue } from '@opentelemetry/api';
import type { Sampler } from '@opentelemetry/sdk-trace-base';

/**
 * Telemetry module configuration options
 */
export interface TelemetryModuleOptions {
  /**
   * Enable/disable telemetry
   * @default true (auto-detected: disabled in test, enabled otherwise)
   */
  enabled?: boolean;

  /**
   * Service name for resource attributes
   * @default process.env.APP_NAME || 'nestjs-app'
   */
  serviceName?: string;

  /**
   * Service version
   * @default process.env.APP_VERSION || package.json version
   */
  serviceVersion?: string;

  /**
   * Environment name
   * @default process.env.NODE_ENV
   */
  environment?: Environments | string;

  /**
   * Service instance ID
   * @default process.env.OTEL_SERVICE_INSTANCE_ID || '${hostname}-${pid}'
   */
  serviceInstanceId?: string;

  /**
   * Tracing configuration
   */
  tracing?: {
    /**
     * Enable tracing
     * @default true
     */
    enabled?: boolean;

    /**
     * Sampling strategy
     * - 'always': Sample all traces
     * - 'never': Don't sample any traces
     * - number: Sample rate (0.0 to 1.0)
     * - 'parent-always': Parent-based sampler, always on for root
     * - 'parent-ratio': Parent-based sampler with ratio
     * - Sampler instance: Custom sampler
     * @default 'always' in development, 0.1 in production
     */
    sampler?: 'always' | 'never' | number | 'parent-always' | 'parent-ratio' | Sampler;

    /**
     * Trace exporter configuration
     */
    exporter?: {
      /**
       * Exporter type
       * @default 'otlp'
       */
      type?: 'otlp' | 'console';

      /**
       * OTLP endpoint URL
       * @default process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317'
       */
      endpoint?: string;

      /**
       * OTLP protocol (grpc or http/protobuf)
       * @default 'grpc'
       */
      protocol?: 'grpc' | 'http';

      /**
       * Additional headers for OTLP exporter
       */
      headers?: Record<string, string>;
    };

    /**
     * Span processor configuration
     */
    processor?: {
      /**
       * Processor type
       * @default 'batch'
       */
      type?: 'batch' | 'simple';

      /**
       * Maximum queue size for batch processor
       * @default 2048
       */
      maxQueueSize?: number;

      /**
       * Maximum export batch size
       * @default 512
       */
      maxExportBatchSize?: number;

      /**
       * Scheduled delay in milliseconds
       * @default 5000
       */
      scheduledDelayMillis?: number;

      /**
       * Export timeout in milliseconds
       * @default 30000
       */
      exportTimeoutMillis?: number;
    };

    /**
     * Additional span attributes
     */
    attributes?: Record<string, AttributeValue>;
  };

  /**
   * Metrics configuration
   */
  metrics?: {
    /**
     * Enable metrics
     * @default true
     */
    enabled?: boolean;

    /**
     * Metrics exporter configuration
     */
    exporter?: {
      /**
       * Exporter type
       * @default 'otlp'
       */
      type?: 'otlp' | 'prometheus' | 'console';

      /**
       * OTLP endpoint URL (for otlp type)
       * @default process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317'
       */
      endpoint?: string;

      /**
       * OTLP protocol (grpc or http/protobuf) - for otlp type only
       * @default 'grpc'
       */
      protocol?: 'grpc' | 'http';

      /**
       * Prometheus port (for prometheus type)
       * @default 9464
       */
      port?: number;

      /**
       * Additional headers for OTLP exporter
       */
      headers?: Record<string, string>;
    };

    /**
     * Export interval in milliseconds
     * @default 10000
     */
    exportIntervalMillis?: number;

    /**
     * Export timeout in milliseconds
     * @default 30000
     */
    exportTimeoutMillis?: number;

    /**
     * Additional metric attributes
     */
    attributes?: Record<string, AttributeValue>;
  };

  /**
   * Logs configuration
   */
  logs?: {
    /**
     * Enable logs
     * @default true
     */
    enabled?: boolean;

    /**
     * Logs exporter configuration
     */
    exporter?: {
      /**
       * Exporter type
       * @default 'otlp'
       */
      type?: 'otlp' | 'console';

      /**
       * OTLP endpoint URL
       * @default process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317'
       */
      endpoint?: string;

      /**
       * OTLP protocol (grpc or http/protobuf)
       * @default 'grpc'
       */
      protocol?: 'grpc' | 'http';

      /**
       * Additional headers for OTLP exporter
       */
      headers?: Record<string, string>;
    };

    /**
     * Log record processor configuration
     */
    processor?: {
      /**
       * Processor type
       * @default 'batch'
       */
      type?: 'batch' | 'simple';

      /**
       * Maximum queue size for batch processor
       * @default 2048
       */
      maxQueueSize?: number;

      /**
       * Maximum export batch size
       * @default 512
       */
      maxExportBatchSize?: number;

      /**
       * Scheduled delay in milliseconds
       * @default 5000
       */
      scheduledDelayMillis?: number;

      /**
       * Export timeout in milliseconds
       * @default 30000
       */
      exportTimeoutMillis?: number;
    };

    /**
     * Additional log attributes
     */
    attributes?: Record<string, AttributeValue>;
  };

  /**
   * Additional resource attributes
   * Resource attributes can be strings, numbers, or booleans
   */
  resourceAttributes?: Record<string, string | number | boolean>;

  /**
   * Resource detection configuration
   */
  resource?: {
    /**
     * Additional resource attributes
     */
    attributes?: Record<string, string | number | boolean>;

    /**
     * Custom resource detectors
     * Note: This is advanced usage, detectors should return Resource instances
     */
    detectors?: Array<
      () =>
        | Promise<import('@opentelemetry/resources').Resource>
        | import('@opentelemetry/resources').Resource
    >;
  };

  /**
   * Auto-instrumentation configuration
   */
  instrumentation?: {
    /**
     * Enable auto-instrumentation
     * @default true
     */
    enabled?: boolean;

    /**
     * Enable NestJS-specific instrumentation
     * @default true
     */
    nestjs?: boolean;

    /**
     * Enable HTTP instrumentation
     * @default true
     */
    http?:
      | boolean
      | {
          /**
           * Enable HTTP instrumentation
           * @default true
           */
          enabled?: boolean;

          /**
           * Capture HTTP request/response headers
           * @default true
           */
          captureHeaders?: boolean;

          /**
           * Capture HTTP request/response bodies
           * @default false (to avoid memory issues with large bodies)
           */
          captureBodies?: boolean;

          /**
           * Maximum body size to capture (in bytes)
           * Bodies larger than this will be truncated
           * @default 10000 (10KB)
           */
          maxBodySize?: number;

          /**
           * Paths to ignore when capturing bodies
           * Useful for skipping health checks, metrics, etc.
           * @default ['/health', '/metrics', '/healthz', '/ready']
           */
          ignorePaths?: string[];
        };

    /**
     * Enable PostgreSQL instrumentation
     * @default true
     */
    pg?:
      | boolean
      | {
          /**
           * Enable PostgreSQL instrumentation
           * @default true
           */
          enabled?: boolean;

          /**
           * Capture query parameters
           * @default true
           */
          captureParameters?: boolean;

          /**
           * Capture query text
           * @default true
           */
          captureQueryText?: boolean;

          /**
           * Capture row count from query results
           * @default true
           */
          captureRowCount?: boolean;
        };

    /**
     * Enable Redis instrumentation
     * @default true
     */
    redis?: boolean;

    /**
     * Enable gRPC instrumentation
     * @default true
     */
    grpc?: boolean;

    /**
     * Additional instrumentation packages to load
     * Note: These must be installed separately
     */
    additional?: string[];
  };

  /**
   * Context propagators configuration
   */
  propagators?: Array<'tracecontext' | 'baggage' | 'b3' | 'jaeger'>;
}

/**
 * Async options for TelemetryModule
 */
export interface TelemetryModuleAsyncOptions<
  TFactoryArgs extends unknown[] = unknown[],
> extends Pick<import('@nestjs/common').ModuleMetadata, 'imports'> {
  /**
   * Dependencies to inject into useFactory
   */
  inject?: {
    [K in keyof TFactoryArgs]: import('@nestjs/common').Type<TFactoryArgs[K]> | string | symbol;
  };

  /**
   * Factory returning TelemetryModuleOptions (sync or async)
   */
  useFactory: (...args: TFactoryArgs) => TelemetryModuleOptions | Promise<TelemetryModuleOptions>;
}
