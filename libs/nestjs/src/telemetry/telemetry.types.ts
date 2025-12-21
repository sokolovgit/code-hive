import { Environments } from '../enums';

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
     * - Sampler instance: Custom sampler
     * @default 'always' in development, 0.1 in production
     */
    sampler?: 'always' | 'never' | number | Sampler;

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
  };

  /**
   * Additional resource attributes
   * Resource attributes can be strings, numbers, or booleans
   */
  resourceAttributes?: Record<string, string | number | boolean>;

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
     * Enable HTTP instrumentation
     * @default true
     */
    http?: boolean;

    /**
     * Enable PostgreSQL instrumentation
     * @default true
     */
    pg?: boolean;

    /**
     * Enable Redis instrumentation
     * @default true
     */
    redis?: boolean;

    /**
     * Additional instrumentation packages to load
     */
    additional?: string[];
  };
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
