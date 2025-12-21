import { readFileSync } from 'fs';
import * as os from 'os';
import { join } from 'path';

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as OTLPTraceExporterHttp } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes, defaultResource } from '@opentelemetry/resources';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  AlwaysOnSampler,
  AlwaysOffSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';

import { Environments } from '../enums';

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
   * @default process.env.APP_NAME || 'nestjs-app'
   */
  serviceName: string;

  /**
   * Service version
   * @default process.env.APP_VERSION || package.json version
   */
  serviceVersion: string;

  /**
   * Environment name
   * @default process.env.NODE_ENV
   */
  environment: string;

  /**
   * OTLP endpoint for traces
   * @default process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317'
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
  if (options.enabled === false || (isTest && options.enabled !== true)) {
    if (!options.silent) {
      console.log('OpenTelemetry initialization skipped (disabled or test environment)');
    }
    return null;
  }

  // Get service name and version
  let serviceName = options.serviceName || process.env.APP_NAME;
  let serviceVersion = options.serviceVersion || process.env.APP_VERSION;

  // Try to read from package.json if version not provided
  if (!serviceVersion) {
    try {
      const packagePath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      serviceVersion = packageJson.version || 'unknown';
      if (!serviceName) {
        serviceName = packageJson.name || 'nestjs-app';
      }
    } catch {
      serviceVersion = serviceVersion || 'unknown';
      serviceName = serviceName || 'nestjs-app';
    }
  }

  // Build resource attributes
  const resourceAttributes: Record<string, string> = {
    [ATTR_SERVICE_NAME]: serviceName || 'nestjs-app',
    [ATTR_SERVICE_VERSION]: serviceVersion || 'unknown',
    'deployment.environment': environment,
    'host.name': os.hostname(),
  };

  // Configure trace exporter
  const endpoint =
    options.endpoint || process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317';
  const protocol = options.protocol || 'grpc';

  const traceExporter =
    protocol === 'grpc'
      ? new OTLPTraceExporter({
          url: endpoint,
        })
      : new OTLPTraceExporterHttp({
          url: endpoint,
        });

  // Configure sampler
  let sampler;
  if (options.sampler) {
    if (options.sampler === 'always') {
      sampler = new AlwaysOnSampler();
    } else if (options.sampler === 'never') {
      sampler = new AlwaysOffSampler();
    } else if (typeof options.sampler === 'number') {
      sampler = new TraceIdRatioBasedSampler(options.sampler);
    }
  } else {
    // Default: always in development, 10% in production
    sampler = isDevelopment ? new AlwaysOnSampler() : new TraceIdRatioBasedSampler(0.1);
  }

  // Configure auto-instrumentations
  // Enable all by default - they will be patched before modules are loaded
  const instrumentations = getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-http': {
      enabled: true,
    },
    '@opentelemetry/instrumentation-pg': {
      enabled: true,
      requireParentSpan: false,
      enhancedDatabaseReporting: true,
      addSqlCommenterCommentToQueries: false,
    },
    '@opentelemetry/instrumentation-redis': {
      enabled: true,
    },
  });

  // Create resource from attributes and merge with default resource
  const resource = defaultResource().merge(resourceFromAttributes(resourceAttributes));

  // Create and start SDK
  const sdk = new NodeSDK({
    resource,
    traceExporter,
    sampler,
    instrumentations,
  });

  try {
    sdk.start();
    globalSdk = sdk; // Store globally for TelemetryModule to reuse
    if (!options.silent) {
      console.log('OpenTelemetry SDK initialized successfully', {
        serviceName,
        serviceVersion,
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
