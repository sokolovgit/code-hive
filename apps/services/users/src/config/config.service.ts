import { BaseConfigService } from '@code-hive/nestjs/config';
import { DrizzleModuleOptions } from '@code-hive/nestjs/database/drizzle';
import { Environments } from '@code-hive/nestjs/enums';
import { HttpLoggingInterceptorOptions, LoggerModuleOptions } from '@code-hive/nestjs/logger';
import { SwaggerModuleOptions } from '@code-hive/nestjs/swagger';
import { TelemetryModuleOptions } from '@code-hive/nestjs/telemetry';
import { Injectable } from '@nestjs/common';

import { EnvType } from './env.schema';

@Injectable()
export class ConfigService extends BaseConfigService<EnvType> {
  server = {
    port: this.env.PORT,
    host: this.env.HOST,
    env: this.env.NODE_ENV,
  };

  package = {
    name: this.env.npm_package_name,
    version: this.env.npm_package_version,
  };

  docs = {
    enabled: this.env.DOCS_ENABLED,
    path: this.env.DOCS_PATH,
  };

  database = {
    url: this.env.DATABASE_URL,
  };

  globalPrefix = 'api/v1';

  isProduction(): boolean {
    return this.server.env === Environments.PRODUCTION;
  }

  isDevelopment(): boolean {
    return this.server.env === Environments.DEVELOPMENT;
  }

  getAppName(): string {
    const { name, version } = this.package;
    return `${name}/v${version}`;
  }

  getLoggerOptions(): LoggerModuleOptions {
    return {
      environment: this.server.env,
      appName: this.getAppName(),
      prettyPrint: false,
    };
  }

  getDrizzleOptions(): DrizzleModuleOptions {
    return {
      connection: this.database.url,
      // schema: ...
      logQueries: this.isDevelopment(),
      pool: {
        min: 2,
        max: 10,
        idleTimeoutMillis: 30000,
        connectionTimeoutMillis: 5000,
      },
      healthCheck: true,
      retry: {
        maxRetries: 3,
        retryDelay: 1000,
      },
    };
  }

  getSwaggerOptions(): SwaggerModuleOptions {
    return {
      title: this.getAppName(),
      description: this.getSwaggerDescription(),
      version: this.package.version,
      path: this.docs.path,
      ui: 'scalar',
      scalar: {
        theme: 'default',
      },
    };
  }

  getHttpLoggingInterceptorOptions(): HttpLoggingInterceptorOptions {
    return {
      logRequestBody: true,
      logResponseBody: true,
      logQuery: true,
      logHeaders: true,
    };
  }

  getTelemetryOptions(): TelemetryModuleOptions {
    // Simple, automatic configuration with sensible defaults
    return {
      serviceName: this.getAppName(),
      serviceVersion: this.package.version,
      environment: this.server.env,
      tracing: {
        sampler: this.isProduction() ? 0.1 : 'always', // 10% in prod, 100% in dev
        exporter: {
          endpoint: this.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
        },
      },
      metrics: {
        exporter: {
          type: 'otlp',
          endpoint: this.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
          protocol: 'grpc',
        },
      },
    };
  }

  private getSwaggerDescription(): string {
    return `API documentation for the ${this.package.name} service`;
  }
}
