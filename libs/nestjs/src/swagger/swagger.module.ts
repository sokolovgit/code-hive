import { DynamicModule, INestApplication, Module, Provider, Type } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule as NestSwaggerModule } from '@nestjs/swagger';

import { SWAGGER_OPTIONS } from './swagger.constants';

import type { ModuleMetadata } from '@nestjs/common/interfaces';

export interface SwaggerAuthConfig {
  /**
   * Bearer token authentication configuration
   */
  bearer?: {
    name?: string;
    description?: string;
  };
  /**
   * Cookie authentication configuration
   */
  cookie?: {
    name?: string;
    description?: string;
  };
}

export interface SwaggerModuleOptions {
  /**
   * Base path for the Swagger UI (e.g., 'api/docs')
   * @default 'api/docs'
   */
  path?: string;
  /**
   * API title
   */
  title: string;
  /**
   * API description
   */
  description?: string;
  /**
   * API version
   * @default '1.0'
   */
  version?: string;
  /**
   * Authentication configuration
   */
  auth?: SwaggerAuthConfig;
  /**
   * Additional Swagger setup options
   */
  swaggerOptions?: {
    explorer?: boolean;
    jsonDocumentUrl?: string;
    [key: string]: unknown;
  };
}

export interface SwaggerModuleAsyncOptions<TFactoryArgs extends unknown[] = unknown[]> extends Pick<
  ModuleMetadata,
  'imports'
> {
  /**
   * Dependencies to inject into `useFactory` (e.g. `ConfigService`)
   */
  inject?: { [K in keyof TFactoryArgs]: Type<TFactoryArgs[K]> | string | symbol };
  /**
   * Factory returning the `SwaggerModuleOptions` (sync or async)
   */
  useFactory: (...args: TFactoryArgs) => SwaggerModuleOptions | Promise<SwaggerModuleOptions>;
}

@Module({})
export class SwaggerModule {
  static forRoot(options: SwaggerModuleOptions): DynamicModule {
    const swaggerOptionsProvider: Provider = {
      provide: SWAGGER_OPTIONS,
      useValue: options,
    };

    return {
      module: SwaggerModule,
      providers: [swaggerOptionsProvider],
      exports: [SWAGGER_OPTIONS],
    };
  }

  static forRootAsync<TFactoryArgs extends unknown[] = unknown[]>(
    options: SwaggerModuleAsyncOptions<TFactoryArgs>
  ): DynamicModule {
    const swaggerOptionsProvider: Provider = {
      provide: SWAGGER_OPTIONS,
      useFactory: options.useFactory,
      inject: (options.inject ?? []) as Array<Type<unknown> | string | symbol>,
    };

    return {
      module: SwaggerModule,
      imports: options.imports ?? [],
      providers: [swaggerOptionsProvider],
      exports: [SWAGGER_OPTIONS],
    };
  }

  /**
   * Setup Swagger for the given NestJS application
   * This should be called in your main.ts after app initialization
   */
  static async setup(app: INestApplication, options: SwaggerModuleOptions): Promise<void> {
    const docsPath = options.path || 'api/docs';
    const config = new DocumentBuilder()
      .setTitle(options.title)
      .setDescription(options.description || options.title)
      .setVersion(options.version || '1.0');

    // Add Bearer Auth if configured
    if (options.auth?.bearer) {
      config.addBearerAuth(
        {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
          description: options.auth.bearer.description || 'Access token',
        },
        options.auth.bearer.name || 'access-token'
      );
    }

    // Add Cookie Auth if configured
    if (options.auth?.cookie) {
      config.addCookieAuth(options.auth.cookie.name || 'refresh-token', {
        type: 'http',
        scheme: 'bearer',
        description: options.auth.cookie.description || 'Refresh token',
      });
    }

    const document = NestSwaggerModule.createDocument(app, config.build());

    const swaggerOptions = {
      explorer: true,
      jsonDocumentUrl: `${docsPath}.json`,
      ...options.swaggerOptions,
    };

    NestSwaggerModule.setup(docsPath, app, document, swaggerOptions);
  }
}
