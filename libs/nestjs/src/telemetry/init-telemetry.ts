import { readFileSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
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

import type { Span } from '@opentelemetry/api';

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

  /**
   * HTTP instrumentation options
   */
  httpInstrumentation?: {
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

  // Configure HTTP instrumentation options
  const httpOptions = options.httpInstrumentation || {};
  const captureHeaders = httpOptions.captureHeaders !== false; // Default: true
  const captureBodies = httpOptions.captureBodies === true; // Default: false
  const maxBodySize = httpOptions.maxBodySize || 10000; // Default: 10KB
  const ignorePaths = httpOptions.ignorePaths || ['/health', '/metrics', '/healthz', '/ready'];

  // Helper function to safely capture body from request/response
  const captureBody = (body: unknown, maxSize: number): string | undefined => {
    if (!body) return undefined;

    try {
      let bodyStr: string;
      if (typeof body === 'string') {
        bodyStr = body;
      } else if (Buffer.isBuffer(body)) {
        bodyStr = body.toString('utf-8');
      } else if (typeof body === 'object') {
        bodyStr = JSON.stringify(body);
      } else {
        bodyStr = String(body);
      }

      if (bodyStr.length > maxSize) {
        return `${bodyStr.substring(0, maxSize)}... [truncated, original size: ${bodyStr.length} bytes]`;
      }
      return bodyStr;
    } catch {
      return '[unable to serialize body]';
    }
  };

  // Helper to check if path should be ignored
  const shouldIgnorePath = (path: string): boolean => {
    return ignorePaths.some((ignorePath) => path.includes(ignorePath));
  };

  // Configure auto-instrumentations
  // Enable all by default - they will be patched before modules are loaded
  const instrumentations = getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-http': {
      enabled: true,
      requestHook: (span: Span, request: IncomingMessage | unknown) => {
        if (!captureHeaders && !captureBodies) return;

        const req = request as IncomingMessage & {
          headers?: Record<string, string | string[]>;
          body?: unknown;
          url?: string;
        };

        // Capture request headers
        if (captureHeaders && req.headers) {
          const headers = req.headers;
          Object.keys(headers).forEach((key) => {
            const value = headers[key];
            if (value !== undefined) {
              span.setAttribute(
                `http.request.header.${key.toLowerCase()}`,
                Array.isArray(value) ? value.join(', ') : value
              );
            }
          });
        }

        // Capture request body (if available and not ignored)
        if (captureBodies && req.url) {
          const url = req.url || '';
          if (!shouldIgnorePath(url)) {
            // For incoming requests, body is typically parsed by NestJS
            // We can try to get it from the request object if it's been parsed
            if (req.body !== undefined) {
              const bodyStr = captureBody(req.body, maxBodySize);
              if (bodyStr) {
                span.setAttribute('http.request.body', bodyStr);
              }
            }
          }
        }
      },
      responseHook: (span: Span, response: ServerResponse | IncomingMessage) => {
        if (!captureHeaders && !captureBodies) return;

        // Response hook receives ServerResponse for server-side or IncomingMessage for client-side
        // For server responses, we need to use getHeaders() method
        if (captureHeaders) {
          try {
            let headers: Record<string, string | string[] | undefined> | undefined;

            // Check if it's a ServerResponse (has getHeaders method)
            if ('getHeaders' in response && typeof response.getHeaders === 'function') {
              headers = response.getHeaders() as Record<string, string | string[] | undefined>;
            }
            // Fallback to headers property if available
            else if ('headers' in response) {
              headers = response.headers as Record<string, string | string[] | undefined>;
            }

            if (headers) {
              Object.keys(headers).forEach((key) => {
                const value = headers![key];
                if (value !== undefined) {
                  span.setAttribute(
                    `http.response.header.${key.toLowerCase()}`,
                    Array.isArray(value) ? value.join(', ') : String(value)
                  );
                }
              });
            }
          } catch {
            // Silently fail if headers can't be accessed
          }
        }

        // Note: Response bodies are not available in responseHook because they're streamed
        // To capture response bodies, use a NestJS interceptor that has access to the response data
      },
    },
    '@opentelemetry/instrumentation-pg': {
      enabled: true,
      requireParentSpan: false,
      enhancedDatabaseReporting: true,
      addSqlCommenterCommentToQueries: false,
      responseHook: (span: Span, responseInfo: { data?: unknown; rowCount?: number }) => {
        // Capture row count if available
        if (responseInfo.rowCount !== undefined) {
          span.setAttribute('db.rows_affected', responseInfo.rowCount);
          span.setAttribute('db.result.count', responseInfo.rowCount);
        }

        // Add query execution metadata
        if (responseInfo.data !== undefined) {
          const resultType = Array.isArray(responseInfo.data) ? 'array' : typeof responseInfo.data;
          span.setAttribute('db.result.type', resultType);
          if (Array.isArray(responseInfo.data)) {
            span.setAttribute('db.result.length', responseInfo.data.length);
          }
        }
      },
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
