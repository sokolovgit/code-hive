import { DocumentBuilder } from '@nestjs/swagger';

import type { SwaggerModuleOptions } from '../types';

/**
 * Builds the OpenAPI document configuration using DocumentBuilder
 */
export class DocumentBuilderConfig {
  /**
   * Builds a DocumentBuilder instance with the provided options
   * @param options - Swagger module options containing API metadata and auth configuration
   * @returns Configured DocumentBuilder instance
   */
  static build(options: SwaggerModuleOptions): DocumentBuilder {
    const config = new DocumentBuilder()
      .setTitle(options.title)
      .setDescription(options.description || options.title)
      .setVersion(options.version || '1.0');

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

    if (options.auth?.cookie) {
      config.addCookieAuth(options.auth.cookie.name || 'refresh-token', {
        type: 'http',
        scheme: 'bearer',
        description: options.auth.cookie.description || 'Refresh token',
      });
    }

    return config;
  }
}
