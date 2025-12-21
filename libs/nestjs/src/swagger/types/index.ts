import { SwaggerAuthConfig } from './auth.types';
import { ScalarOptions } from './scalar.types';
import { SwaggerUIOptions } from './swagger-ui.types';

import type { Type } from '@nestjs/common';
import type { ModuleMetadata } from '@nestjs/common/interfaces';

export * from './auth.types';
export * from './openapi-document.types';
export * from './scalar.types';
export * from './swagger-ui.types';

export type UIProvider = 'swagger-ui' | 'scalar';

/**
 * Base options shared by all Swagger module configurations
 */
interface SwaggerModuleOptionsBase {
  /**
   * Base path for the API documentation (e.g., 'api/docs')
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
}

/**
 * Swagger module options when using Swagger UI
 */
export interface SwaggerModuleOptionsWithSwaggerUI extends SwaggerModuleOptionsBase {
  /**
   * UI provider set to 'swagger-ui' or omitted (defaults to 'swagger-ui')
   */
  ui?: 'swagger-ui';

  /**
   * Swagger UI specific options
   */
  swaggerUI?: SwaggerUIOptions;

  /**
   * Scalar options are not allowed when using Swagger UI
   */
  scalar?: never;
}

/**
 * Swagger module options when using Scalar
 */
export interface SwaggerModuleOptionsWithScalar extends SwaggerModuleOptionsBase {
  /**
   * UI provider set to 'scalar'
   */
  ui: 'scalar';

  /**
   * Scalar specific options
   */
  scalar?: ScalarOptions;

  /**
   * Swagger UI options are not allowed when using Scalar
   */
  swaggerUI?: never;
}

/**
 * Swagger module options - discriminated union based on UI provider
 */
export type SwaggerModuleOptions =
  | SwaggerModuleOptionsWithSwaggerUI
  | SwaggerModuleOptionsWithScalar;

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
