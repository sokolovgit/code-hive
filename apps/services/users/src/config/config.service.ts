import { BaseConfigService } from '@code-hive/nestjs/config';
import { Environments } from '@code-hive/nestjs/enums';
import { HttpLoggingInterceptorOptions, LoggerModuleOptions } from '@code-hive/nestjs/logger';
import { SwaggerModuleOptions } from '@code-hive/nestjs/swagger';
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

  private getSwaggerDescription(): string {
    return `API documentation for the ${this.package.name} service`;
  }
}
