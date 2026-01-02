import {
  DynamicModule,
  Global,
  Module,
  OnModuleInit,
  OnModuleDestroy,
  Provider,
  Type,
} from '@nestjs/common';
import { trace, metrics, Tracer, Meter } from '@opentelemetry/api';
import { NodeSDK } from '@opentelemetry/sdk-node';
import { ClsService } from 'nestjs-cls';

import { ClsModuleWrapper } from '../cls';
import { LoggerModule, LoggerService, LoggerContextService } from '../logger';
import { getAppName, getAppVersion } from '../utils';

import { getGlobalSdk } from './init-telemetry';
import { createAutoInstrumentations } from './instrumentations/auto-instrumentations';
import { createNestJSInstrumentation } from './instrumentations/nestjs.instrumentation';
import { HttpSpanInterceptor, TraceInterceptor, MetricsInterceptor } from './interceptors';
import { startSDK, SDKFactoryOptions } from './sdk/sdk.factory';
import {
  TELEMETRY_OPTIONS,
  TELEMETRY_SDK,
  TELEMETRY_TRACER,
  TELEMETRY_METER,
  TELEMETRY_LOGGER,
} from './telemetry.constants';
import { TelemetryService } from './telemetry.service';
import { TelemetryModuleOptions, TelemetryModuleAsyncOptions } from './telemetry.types';
import { validateTelemetryOptions } from './utils/validation.utils';

@Global()
@Module({})
export class TelemetryModule implements OnModuleInit, OnModuleDestroy {
  private static sdk: NodeSDK | null = null;

  static forRoot(options: TelemetryModuleOptions = {}): DynamicModule {
    const providers = this.createProviders(options);

    // TelemetryModule requires LoggerModule and ClsModule for full integration
    const imports: Type<unknown>[] = [LoggerModule, ClsModuleWrapper];

    return {
      module: TelemetryModule,
      imports,
      providers,
      exports: [
        TelemetryService,
        TELEMETRY_TRACER,
        TELEMETRY_METER,
        TELEMETRY_LOGGER,
        TELEMETRY_SDK,
        TraceInterceptor,
        HttpSpanInterceptor,
        MetricsInterceptor,
      ],
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

    // TelemetryModule requires LoggerModule and ClsModule for full integration
    const requiredImports: Type<unknown>[] = [LoggerModule, ClsModuleWrapper];

    return {
      module: TelemetryModule,
      imports: [...requiredImports, ...(options.imports ?? [])],
      providers: [...providers, TraceInterceptor, MetricsInterceptor],
      exports: [
        TelemetryService,
        TELEMETRY_TRACER,
        TELEMETRY_METER,
        TELEMETRY_LOGGER,
        TELEMETRY_SDK,
        TraceInterceptor,
        HttpSpanInterceptor,
        MetricsInterceptor,
      ],
    };
  }

  private static createProviders(options: TelemetryModuleOptions): Provider[] {
    // Validate options
    validateTelemetryOptions(options);

    const optionsProvider: Provider = {
      provide: TELEMETRY_OPTIONS,
      useValue: options,
    };

    const sdkProvider: Provider = {
      provide: TELEMETRY_SDK,
      useFactory: (opts: TelemetryModuleOptions, logger: LoggerService) => {
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
        const serviceName = opts.serviceName || getAppName();
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
        const serviceName = opts.serviceName || getAppName();
        return metrics.getMeter(serviceName);
      },
      inject: [TELEMETRY_OPTIONS],
    };

    const loggerProvider: Provider = {
      provide: TELEMETRY_LOGGER,
      useFactory: (opts: TelemetryModuleOptions) => {
        if (!opts.enabled && opts.enabled !== undefined) {
          return null;
        }
        if (opts.logs?.enabled === false) {
          return null;
        }
        // Get the logger from the OpenTelemetry logs API
        const serviceName = opts.serviceName || getAppName();
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { logs } = require('@opentelemetry/api-logs');
          return logs.getLogger(serviceName);
        } catch {
          // OpenTelemetry logs API not available
          return null;
        }
      },
      inject: [TELEMETRY_OPTIONS],
    };

    const httpSpanInterceptorProvider: Provider = {
      provide: HttpSpanInterceptor,
      useFactory: (
        opts: TelemetryModuleOptions,
        cls: ClsService,
        loggerContext: LoggerContextService
      ) => {
        return new HttpSpanInterceptor(opts, cls, loggerContext);
      },
      inject: [TELEMETRY_OPTIONS, ClsService, LoggerContextService],
    };

    const telemetryServiceProvider: Provider = {
      provide: TelemetryService,
      useFactory: (
        tracer: Tracer,
        meter: Meter,
        logger: unknown | null,
        loggerContext: LoggerContextService,
        cls: ClsService
      ) => {
        return new TelemetryService(tracer, meter, logger, loggerContext, cls);
      },
      inject: [
        TELEMETRY_TRACER,
        TELEMETRY_METER,
        TELEMETRY_LOGGER,
        LoggerContextService,
        ClsService,
      ],
    };

    return [
      optionsProvider,
      sdkProvider,
      tracerProvider,
      meterProvider,
      loggerProvider,
      telemetryServiceProvider,
      httpSpanInterceptorProvider,
    ];
  }

  private static createAsyncProviders(optionsProvider: Provider): Provider[] {
    const sdkProvider: Provider = {
      provide: TELEMETRY_SDK,
      useFactory: (opts: TelemetryModuleOptions, logger: LoggerService) => {
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
        const serviceName = opts.serviceName || getAppName();
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
        const serviceName = opts.serviceName || getAppName();
        return metrics.getMeter(serviceName);
      },
      inject: [TELEMETRY_OPTIONS],
    };

    const loggerProvider: Provider = {
      provide: TELEMETRY_LOGGER,
      useFactory: (opts: TelemetryModuleOptions) => {
        if (!opts.enabled && opts.enabled !== undefined) {
          return null;
        }
        if (opts.logs?.enabled === false) {
          return null;
        }
        // Get the logger from the OpenTelemetry logs API
        const serviceName = opts.serviceName || getAppName();
        try {
          // eslint-disable-next-line @typescript-eslint/no-require-imports
          const { logs } = require('@opentelemetry/api-logs');
          return logs.getLogger(serviceName);
        } catch {
          // OpenTelemetry logs API not available
          return null;
        }
      },
      inject: [TELEMETRY_OPTIONS],
    };

    const asyncHttpSpanInterceptorProvider: Provider = {
      provide: HttpSpanInterceptor,
      useFactory: (
        opts: TelemetryModuleOptions,
        cls: ClsService,
        loggerContext: LoggerContextService
      ) => {
        return new HttpSpanInterceptor(opts, cls, loggerContext);
      },
      inject: [TELEMETRY_OPTIONS, ClsService, LoggerContextService],
    };

    const telemetryServiceProvider: Provider = {
      provide: TelemetryService,
      useFactory: (
        tracer: Tracer,
        meter: Meter,
        logger: unknown | null,
        loggerContext: LoggerContextService,
        cls: ClsService
      ) => {
        return new TelemetryService(tracer, meter, logger, loggerContext, cls);
      },
      inject: [
        TELEMETRY_TRACER,
        TELEMETRY_METER,
        TELEMETRY_LOGGER,
        LoggerContextService,
        ClsService,
      ],
    };

    return [
      optionsProvider,
      sdkProvider,
      tracerProvider,
      meterProvider,
      loggerProvider,
      telemetryServiceProvider,
      asyncHttpSpanInterceptorProvider,
    ];
  }

  private static createSDK(options: TelemetryModuleOptions, logger: LoggerService): NodeSDK | null {
    // If SDK was already initialized (e.g., via initOpenTelemetry), reuse it
    const existingSdk = getGlobalSdk() || TelemetryModule.sdk;
    if (existingSdk) {
      logger.debug('OpenTelemetry SDK already initialized, reusing existing instance');
      TelemetryModule.sdk = existingSdk;
      return existingSdk;
    }

    // Check if telemetry is disabled
    if (options.enabled === false) {
      logger.debug('OpenTelemetry is disabled');
      return null;
    }

    const environment = (options.environment || process.env.NODE_ENV || 'development') as string;
    const isTest = environment === 'test';

    // Don't initialize in test environment unless explicitly enabled
    if (isTest && options.enabled !== true) {
      logger.debug('OpenTelemetry is disabled in test environment');
      return null;
    }

    // Create instrumentations
    const autoInstrumentations = createAutoInstrumentations({
      enabled: options.instrumentation?.enabled !== false,
      http: options.instrumentation?.http,
      pg: options.instrumentation?.pg,
      redis: options.instrumentation?.redis,
      grpc: options.instrumentation?.grpc,
    });

    // Add NestJS instrumentation if enabled
    const nestjsInstrumentation =
      options.instrumentation?.nestjs !== false ? createNestJSInstrumentation(true) : null;
    const instrumentations = nestjsInstrumentation
      ? [...autoInstrumentations, nestjsInstrumentation]
      : autoInstrumentations;

    // Build SDK options
    const sdkOptions: SDKFactoryOptions = {
      enabled: options.enabled === undefined ? true : options.enabled,
      serviceName: options.serviceName,
      serviceVersion: options.serviceVersion,
      environment,
      resource: {
        attributes: options.resourceAttributes,
        detectors: options.resource?.detectors,
      },
      tracing: {
        enabled: options.tracing?.enabled !== false,
        sampler: options.tracing?.sampler,
        exporter: options.tracing?.exporter,
        processor: options.tracing?.processor,
        // attributes: options.tracing?.attributes, // Attributes are set on spans, not provider
      },
      metrics: {
        enabled: options.metrics?.enabled !== false,
        exporter: options.metrics?.exporter,
        exportIntervalMillis: options.metrics?.exportIntervalMillis,
        exportTimeoutMillis: options.metrics?.exportTimeoutMillis,
        // attributes: options.metrics?.attributes, // Attributes are set on metrics, not provider
      },
      logs: {
        enabled: options.logs?.enabled !== false,
        exporter: options.logs?.exporter,
        processor: options.logs?.processor,
        // attributes: options.logs?.attributes, // Attributes are set on logs, not provider
      },
      instrumentations,
      // propagators: options.propagators, // Will be handled by SDK factory
    };

    // Start SDK
    try {
      const sdk = startSDK(sdkOptions);
      if (sdk) {
        logger.info('OpenTelemetry SDK started', {
          serviceName: options.serviceName || getAppName(),
          serviceVersion: options.serviceVersion || getAppVersion(),
          environment,
        });
        TelemetryModule.sdk = sdk;
      }
      return sdk;
    } catch (error) {
      logger.error('Failed to start OpenTelemetry SDK', {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
      });
      return null;
    }
  }

  onModuleInit(): void {
    // SDK is initialized in the provider factory
  }

  async onModuleDestroy(): Promise<void> {
    if (TelemetryModule.sdk) {
      await TelemetryModule.sdk.shutdown();
      TelemetryModule.sdk = null;
    }
  }
}
