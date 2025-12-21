import { apiReference } from '@scalar/nestjs-api-reference';

import type { OpenAPIDocument, ScalarOptions, SwaggerModuleOptionsWithScalar } from '../types';
import type { INestApplication } from '@nestjs/common';

/**
 * Sets up Scalar API Reference for the NestJS application
 */
export class ScalarSetup {
  /**
   * Configures and mounts Scalar API Reference with the provided OpenAPI document
   * @param app - NestJS application instance
   * @param document - OpenAPI document generated from the application
   * @param options - Swagger module options containing Scalar configuration
   */
  static setup(
    app: INestApplication,
    document: OpenAPIDocument,
    options: SwaggerModuleOptionsWithScalar
  ): void {
    const docsPath = options.path || 'api/docs';
    const normalizedPath = docsPath.startsWith('/') ? docsPath : `/${docsPath}`;
    const scalarOptions: ScalarOptions = options.scalar || {};

    const configuration = {
      content: document,
      ...(scalarOptions.theme && { theme: scalarOptions.theme }),
      ...scalarOptions.scalarOptions,
    };

    const middleware = apiReference(configuration);

    const expressApp = app.getHttpAdapter().getInstance();
    expressApp.use(normalizedPath, middleware);
  }
}
