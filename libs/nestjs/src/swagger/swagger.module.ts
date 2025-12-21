import { DynamicModule, INestApplication, Module, Provider, Type } from '@nestjs/common';
import { SwaggerModule as NestSwaggerModule } from '@nestjs/swagger';

import { DocumentBuilderConfig } from './config';
import { SWAGGER_OPTIONS } from './swagger.constants';
import { ScalarSetup, SwaggerUISetup } from './ui';

import type {
  SwaggerModuleAsyncOptions,
  SwaggerModuleOptions,
  SwaggerModuleOptionsWithScalar,
  SwaggerModuleOptionsWithSwaggerUI,
} from './types';

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
   * Setup Swagger or Scalar UI for the given NestJS application
   * This should be called in your main.ts after app initialization
   */
  static async setup(app: INestApplication, options: SwaggerModuleOptions): Promise<void> {
    const config = DocumentBuilderConfig.build(options);
    const document = NestSwaggerModule.createDocument(app, config.build());

    const uiProvider = options.ui || 'swagger-ui';

    if (uiProvider === 'scalar') {
      ScalarSetup.setup(app, document, options as SwaggerModuleOptionsWithScalar);
    } else {
      SwaggerUISetup.setup(app, document, options as SwaggerModuleOptionsWithSwaggerUI);
    }
  }
}
