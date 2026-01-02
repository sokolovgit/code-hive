import { NodeSDK } from '@opentelemetry/sdk-node';

import { Environments } from '../enums';
import { getAppName, getAppVersion } from '../utils';

import { createAutoInstrumentations } from './instrumentations/auto-instrumentations';
import { createNestJSInstrumentation } from './instrumentations/nestjs.instrumentation';
import { startSDK, SDKFactoryOptions } from './sdk/sdk.factory';

// Store the SDK instance so TelemetryModule can reuse it
let globalSdk: NodeSDK | null = null;

/**
 * Get the globally initialized SDK instance (if any)
 * @internal
 */
export const getGlobalSdk = (): NodeSDK | null => globalSdk;

export type InitTelemetryOptions = Partial<{
  /**
   * Enable/disable telemetry initialization
   * @default true (auto-detected: disabled in test, enabled otherwise)
   */
  enabled: boolean;

  /**
   * Service name
   * @default getAppName()
   */
  serviceName: string;

  /**
   * Service version
   * @default getAppVersion()
   */
  serviceVersion: string;

  /**
   * Environment name
   * @default process.env.NODE_ENV
   */
  environment: string;

  /**
   * OTLP endpoint for traces/metrics/logs
   * @default process.env.OTLP_URL || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317'
   */
  endpoint: string;

  /**
   * OTLP protocol (grpc or http)
   * @default 'grpc'
   */
  protocol: 'grpc' | 'http';

  /**
   * Sampling strategy
   * @default 'always' in development, 0.1 in production
   */
  sampler: 'always' | 'never' | number;

  /**
   * Silent mode (don't log initialization)
   * @default false
   */
  silent: boolean;

  /**
   * HTTP instrumentation options
   */
  httpInstrumentation?: {
    captureHeaders?: boolean;
    captureBodies?: boolean;
    maxBodySize?: number;
    ignorePaths?: string[];
  };
}>;

/**
 * Initialize OpenTelemetry SDK early, before any modules are imported.
 * This ensures that instrumentation patches (like pg, http) are applied
 * before the modules are loaded.
 *
 * This should be called in main.ts before any other imports:
 * ```typescript
 * import { loadEnv } from '@code-hive/nestjs/config';
 * import { initOpenTelemetry } from '@code-hive/nestjs/telemetry';
 *
 * loadEnv();
 * initOpenTelemetry();
 * // ... rest of imports
 * ```
 */
export const initOpenTelemetry = (options: InitTelemetryOptions = {}) => {
  const environment = options.environment || process.env.NODE_ENV || Environments.DEVELOPMENT;
  const isDevelopment = environment === Environments.DEVELOPMENT;
  const isTest = environment === Environments.TEST;

  // Check if telemetry is disabled
  if (
    options.enabled === false ||
    (isTest && options.enabled !== true && options.enabled !== undefined)
  ) {
    if (!options.silent) {
      console.log('OpenTelemetry initialization skipped (disabled or test environment)');
    }
    return null;
  }

  // Build SDK options
  // Check OTLP_URL first, then OTEL_EXPORTER_OTLP_ENDPOINT for backward compatibility
  const defaultEndpoint =
    process.env.OTLP_URL || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
  const endpoint = options.endpoint || defaultEndpoint;
  const protocol = options.protocol || 'grpc';

  // Create instrumentations
  const autoInstrumentations = createAutoInstrumentations({
    enabled: true,
    http: options.httpInstrumentation,
    pg: true,
    redis: true,
    grpc: true,
  });

  // Add NestJS instrumentation if available
  const nestjsInstrumentation = createNestJSInstrumentation(true);
  const instrumentations = nestjsInstrumentation
    ? [...autoInstrumentations, nestjsInstrumentation]
    : autoInstrumentations;

  // Create SDK options
  const sdkOptions: SDKFactoryOptions = {
    enabled: options.enabled === undefined ? true : options.enabled,
    serviceName: options.serviceName,
    serviceVersion: options.serviceVersion,
    environment,
    tracing: {
      enabled: true,
      sampler: options.sampler || (isDevelopment ? 'always' : 0.1),
      exporter: {
        type: 'otlp',
        endpoint,
        protocol,
      },
      processor: {
        type: 'batch',
      },
    },
    metrics: {
      enabled: true,
      exporter: {
        type: 'otlp',
        endpoint,
        protocol,
      },
    },
    logs: {
      enabled: true,
      exporter: {
        type: 'otlp',
        endpoint,
        protocol,
      },
    },
    instrumentations,
  };

  // Start SDK
  try {
    const sdk = startSDK(sdkOptions);
    globalSdk = sdk;

    if (!options.silent && sdk) {
      console.log('OpenTelemetry SDK initialized successfully', {
        serviceName: options.serviceName || getAppName(),
        serviceVersion: options.serviceVersion || getAppVersion(),
        environment,
        endpoint,
        protocol,
      });
    }

    return sdk;
  } catch (error) {
    if (!options.silent) {
      console.error('Failed to initialize OpenTelemetry SDK:', error);
    }
    return null;
  }
};
