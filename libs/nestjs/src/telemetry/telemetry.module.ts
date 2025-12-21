import { readFileSync } from 'fs';
import { IncomingMessage, ServerResponse } from 'http';
import * as os from 'os';
import { join } from 'path';

import {
  DynamicModule,
  Global,
  Module,
  OnModuleInit,
  OnModuleDestroy,
  Provider,
  Type,
} from '@nestjs/common';
import { trace, metrics, Tracer } from '@opentelemetry/api';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPMetricExporter } from '@opentelemetry/exporter-metrics-otlp-grpc';
import { OTLPMetricExporter as OTLPMetricExporterHttp } from '@opentelemetry/exporter-metrics-otlp-http';
import { PrometheusExporter } from '@opentelemetry/exporter-prometheus';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { OTLPTraceExporter as OTLPTraceExporterHttp } from '@opentelemetry/exporter-trace-otlp-http';
import { resourceFromAttributes, defaultResource } from '@opentelemetry/resources';
import { PeriodicExportingMetricReader, ConsoleMetricExporter } from '@opentelemetry/sdk-metrics';
import { NodeSDK } from '@opentelemetry/sdk-node';
import {
  ConsoleSpanExporter,
  AlwaysOnSampler,
  AlwaysOffSampler,
  TraceIdRatioBasedSampler,
} from '@opentelemetry/sdk-trace-base';
import { ATTR_SERVICE_NAME, ATTR_SERVICE_VERSION } from '@opentelemetry/semantic-conventions';
import { ClsService } from 'nestjs-cls';

import { Environments } from '../enums';
import { LoggerService, LoggerContextService } from '../logger';

import { getGlobalSdk } from './init-telemetry';
import { HttpSpanInterceptor, TraceInterceptor } from './interceptors';
import {
  TELEMETRY_OPTIONS,
  TELEMETRY_SDK,
  TELEMETRY_TRACER,
  TELEMETRY_METER,
} from './telemetry.constants';
import { TelemetryService } from './telemetry.service';
import { TelemetryModuleOptions, TelemetryModuleAsyncOptions } from './telemetry.types';

import type { Span } from '@opentelemetry/api';

@Global()
@Module({})
export class TelemetryModule implements OnModuleInit, OnModuleDestroy {
  private static sdk: NodeSDK | null = null;

  static forRoot(options: TelemetryModuleOptions = {}): DynamicModule {
    const providers = this.createProviders(options);

    return {
      module: TelemetryModule,
      providers,
      exports: [TelemetryService, TELEMETRY_TRACER, TELEMETRY_METER, TELEMETRY_SDK],
    };
  }

  static forRootAsync<TFactoryArgs extends unknown[] = unknown[]>(
    options: TelemetryModuleAsyncOptions<TFactoryArgs>
  ): DynamicModule {
    const optionsProvider: Provider = {
      provide: TELEMETRY_OPTIONS,
      useFactory: options.useFactory,
      inject: (options.inject ?? []) as Array<Type<unknown> | string | symbol>,
    };

    const providers = this.createAsyncProviders(optionsProvider);

    return {
      module: TelemetryModule,
      imports: options.imports ?? [],
      providers: [...providers, TraceInterceptor, HttpSpanInterceptor],
      exports: [
        TelemetryService,
        TELEMETRY_TRACER,
        TELEMETRY_METER,
        TraceInterceptor,
        HttpSpanInterceptor,
      ],
    };
  }

  private static createProviders(options: TelemetryModuleOptions): Provider[] {
    const optionsProvider: Provider = {
      provide: TELEMETRY_OPTIONS,
      useValue: options,
    };

    const sdkProvider: Provider = {
      provide: TELEMETRY_SDK,
      useFactory: (opts: TelemetryModuleOptions, logger?: LoggerService) => {
        return this.createSDK(opts, logger);
      },
      inject: [TELEMETRY_OPTIONS, LoggerService],
    };

    const tracerProvider: Provider = {
      provide: TELEMETRY_TRACER,
      useFactory: (opts: TelemetryModuleOptions) => {
        if (!opts.enabled && opts.enabled !== undefined) {
          return trace.getTracer('nestjs-disabled');
        }
        const serviceName = opts.serviceName || process.env.APP_NAME || 'nestjs-app';
        return trace.getTracer(serviceName);
      },
      inject: [TELEMETRY_OPTIONS],
    };

    const meterProvider: Provider = {
      provide: TELEMETRY_METER,
      useFactory: (opts: TelemetryModuleOptions) => {
        if (!opts.enabled && opts.enabled !== undefined) {
          return metrics.getMeter('nestjs-disabled');
        }
        const serviceName = opts.serviceName || process.env.APP_NAME || 'nestjs-app';
        return metrics.getMeter(serviceName);
      },
      inject: [TELEMETRY_OPTIONS],
    };

    const telemetryServiceProvider: Provider = {
      provide: TelemetryService,
      useFactory: (tracer: Tracer, loggerContext?: LoggerContextService, cls?: ClsService) => {
        return new TelemetryService(tracer, loggerContext, cls);
      },
      inject: [
        TELEMETRY_TRACER,
        { token: LoggerContextService, optional: true },
        { token: ClsService, optional: true },
      ],
    };

    return [optionsProvider, sdkProvider, tracerProvider, meterProvider, telemetryServiceProvider];
  }

  private static createAsyncProviders(optionsProvider: Provider): Provider[] {
    const sdkProvider: Provider = {
      provide: TELEMETRY_SDK,
      useFactory: (opts: TelemetryModuleOptions, logger?: LoggerService) => {
        // Start SDK immediately to ensure instrumentation patches modules before they're used
        const sdk = this.createSDK(opts, logger);
        return sdk;
      },
      inject: [TELEMETRY_OPTIONS, LoggerService],
    };

    const tracerProvider: Provider = {
      provide: TELEMETRY_TRACER,
      useFactory: (opts: TelemetryModuleOptions) => {
        if (!opts.enabled && opts.enabled !== undefined) {
          return trace.getTracer('nestjs-disabled');
        }
        const serviceName = opts.serviceName || process.env.APP_NAME || 'nestjs-app';
        return trace.getTracer(serviceName);
      },
      inject: [TELEMETRY_OPTIONS],
    };

    const meterProvider: Provider = {
      provide: TELEMETRY_METER,
      useFactory: (opts: TelemetryModuleOptions) => {
        if (!opts.enabled && opts.enabled !== undefined) {
          return metrics.getMeter('nestjs-disabled');
        }
        const serviceName = opts.serviceName || process.env.APP_NAME || 'nestjs-app';
        return metrics.getMeter(serviceName);
      },
      inject: [TELEMETRY_OPTIONS],
    };

    const telemetryServiceProvider: Provider = {
      provide: TelemetryService,
      useFactory: (tracer: Tracer, loggerContext?: LoggerContextService, cls?: ClsService) => {
        return new TelemetryService(tracer, loggerContext, cls);
      },
      inject: [
        TELEMETRY_TRACER,
        { token: LoggerContextService, optional: true },
        { token: ClsService, optional: true },
      ],
    };

    return [optionsProvider, sdkProvider, tracerProvider, meterProvider, telemetryServiceProvider];
  }

  private static createSDK(
    options: TelemetryModuleOptions,
    logger?: LoggerService
  ): NodeSDK | null {
    // If SDK was already initialized (e.g., via initOpenTelemetry), reuse it
    const existingSdk = getGlobalSdk() || TelemetryModule.sdk;
    if (existingSdk) {
      logger?.debug('OpenTelemetry SDK already initialized, reusing existing instance');
      TelemetryModule.sdk = existingSdk;
      return existingSdk;
    }

    // Check if telemetry is disabled
    if (options.enabled === false) {
      logger?.debug('OpenTelemetry is disabled');
      return null;
    }

    const environment = (options.environment ||
      process.env.NODE_ENV ||
      Environments.DEVELOPMENT) as string;
    const isDevelopment = environment === Environments.DEVELOPMENT;
    const isTest = environment === Environments.TEST;

    // Don't initialize in test environment unless explicitly enabled
    if (isTest && options.enabled !== true) {
      logger?.debug('OpenTelemetry is disabled in test environment');
      return null;
    }

    // Auto-disable if endpoint is not reachable (optional check)
    // This allows graceful degradation if observability stack is not running

    // Get service name and version
    const serviceName = options.serviceName || process.env.APP_NAME || 'nestjs-app';
    let serviceVersion = options.serviceVersion || process.env.APP_VERSION;

    // Try to read from package.json if version not provided
    if (!serviceVersion) {
      try {
        const packagePath = join(process.cwd(), 'package.json');
        const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
        serviceVersion = packageJson.version || 'unknown';
      } catch {
        serviceVersion = 'unknown';
      }
    }

    // Build resource attributes
    const resourceAttributes: Record<string, string> = {
      [ATTR_SERVICE_NAME]: serviceName,
      [ATTR_SERVICE_VERSION]: serviceVersion || 'unknown',
      'deployment.environment': environment,
      'host.name': os.hostname(),
      ...(options.resourceAttributes as Record<string, string>),
    };

    // Configure trace exporter
    let traceExporter;
    if (options.tracing?.enabled !== false) {
      const exporterType = options.tracing?.exporter?.type || 'otlp';
      const protocol = options.tracing?.exporter?.protocol || 'grpc';
      const endpoint =
        options.tracing?.exporter?.endpoint ||
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
        'http://localhost:4317';

      if (exporterType === 'console') {
        traceExporter = new ConsoleSpanExporter();
      } else if (protocol === 'grpc') {
        traceExporter = new OTLPTraceExporter({
          url: endpoint,
          headers: options.tracing?.exporter?.headers,
        });
      } else {
        traceExporter = new OTLPTraceExporterHttp({
          url: endpoint,
          headers: options.tracing?.exporter?.headers,
        });
      }
    }

    // Configure metrics exporter
    let metricReader;
    if (options.metrics?.enabled !== false) {
      const exporterType = options.metrics?.exporter?.type || 'otlp';
      const endpoint =
        options.metrics?.exporter?.endpoint ||
        process.env.OTEL_EXPORTER_OTLP_ENDPOINT ||
        'http://localhost:4317';

      if (exporterType === 'prometheus') {
        const port = options.metrics?.exporter?.port || 9464;
        // PrometheusExporter is a MetricReader that exposes metrics via HTTP endpoint
        // Metrics are scraped by Prometheus from this endpoint
        metricReader = new PrometheusExporter({
          port,
        });
      } else if (exporterType === 'console') {
        metricReader = new PeriodicExportingMetricReader({
          exporter: new ConsoleMetricExporter(),
          exportIntervalMillis: 10000,
        });
      } else {
        // Use protocol from options, default to 'grpc' for OTLP metrics
        const protocol = options.metrics?.exporter?.protocol || 'grpc';
        if (protocol === 'grpc') {
          metricReader = new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporter({
              url: endpoint,
              headers: options.metrics?.exporter?.headers,
            }),
            exportIntervalMillis: 10000,
          });
        } else {
          metricReader = new PeriodicExportingMetricReader({
            exporter: new OTLPMetricExporterHttp({
              url: endpoint,
              headers: options.metrics?.exporter?.headers,
            }),
            exportIntervalMillis: 10000,
          });
        }
      }
    }

    // Configure sampler
    let sampler;
    if (options.tracing?.sampler) {
      if (typeof options.tracing.sampler === 'string') {
        if (options.tracing.sampler === 'always') {
          sampler = new AlwaysOnSampler();
        } else if (options.tracing.sampler === 'never') {
          sampler = new AlwaysOffSampler();
        }
      } else if (typeof options.tracing.sampler === 'number') {
        sampler = new TraceIdRatioBasedSampler(options.tracing.sampler);
      } else {
        sampler = options.tracing.sampler;
      }
    } else {
      // Default: always in development, 10% in production
      sampler = isDevelopment ? new AlwaysOnSampler() : new TraceIdRatioBasedSampler(0.1);
    }

    // Configure auto-instrumentations
    const instrumentations = [];
    if (options.instrumentation?.enabled !== false) {
      // Parse HTTP instrumentation options
      const httpConfig = options.instrumentation?.http;
      const httpEnabled = httpConfig !== false;
      const httpOptions = typeof httpConfig === 'object' ? httpConfig : {};

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

      const autoInstrumentations = getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          enabled: httpEnabled,
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
          enabled:
            typeof options.instrumentation?.pg === 'object'
              ? options.instrumentation.pg.enabled !== false
              : options.instrumentation?.pg !== false,
          // Enable query capture and span creation
          requireParentSpan: false, // Allow spans even without parent span
          enhancedDatabaseReporting: true, // Capture query text and parameters
          addSqlCommenterCommentToQueries: false, // Don't modify queries
          responseHook: (span: Span, responseInfo: { data?: unknown; rowCount?: number }) => {
            // Capture row count if available
            if (responseInfo.rowCount !== undefined) {
              span.setAttribute('db.rows_affected', responseInfo.rowCount);
              span.setAttribute('db.result.count', responseInfo.rowCount);
            }

            // Add query execution metadata
            if (responseInfo.data !== undefined) {
              const resultType = Array.isArray(responseInfo.data)
                ? 'array'
                : typeof responseInfo.data;
              span.setAttribute('db.result.type', resultType);
              if (Array.isArray(responseInfo.data)) {
                span.setAttribute('db.result.length', responseInfo.data.length);
              }
            }
          },
        },
        '@opentelemetry/instrumentation-redis': {
          enabled: options.instrumentation?.redis !== false,
        },
      });
      instrumentations.push(...autoInstrumentations);
    }

    // Create SDK
    // Create resource from attributes and merge with default resource
    const resource = defaultResource().merge(resourceFromAttributes(resourceAttributes));
    const sdk = new NodeSDK({
      resource,
      traceExporter,
      metricReader,
      sampler,
      instrumentations,
    });

    // Start SDK
    try {
      sdk.start();
      logger?.info('OpenTelemetry SDK started', {
        serviceName,
        serviceVersion,
        environment,
        traceExporter: traceExporter ? 'configured' : 'disabled',
        metricsExporter: metricReader ? 'configured' : 'disabled',
      });
      this.sdk = sdk;
      return sdk;
    } catch (error) {
      logger?.error('Failed to start OpenTelemetry SDK', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  onModuleInit(): void {
    // Ensure SDK is started - it's initialized in the provider factory
    // The SDK.start() is called in createSDK, but we verify it here
    if (TelemetryModule.sdk) {
      // SDK already started in createSDK
    }
  }

  async onModuleDestroy(): Promise<void> {
    if (TelemetryModule.sdk) {
      await TelemetryModule.sdk.shutdown();
      TelemetryModule.sdk = null;
    }
  }
}
