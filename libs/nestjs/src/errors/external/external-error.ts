import { HttpStatus } from '@nestjs/common';
import { BaseError } from '../base/base-error';

/**
 * External service error class.
 * Used for errors from third-party APIs, services, or external dependencies.
 */
export class ExternalError extends BaseError {
  /**
   * Name of the external service that caused the error
   */
  public readonly serviceName?: string;

  /**
   * Original error from the external service
   */
  public readonly originalError?: unknown;

  constructor(
    message: string,
    code: string,
    options?: {
      serviceName?: string;
      originalError?: unknown;
      statusCode?: number;
      metadata?: Record<string, unknown>;
      cause?: Error;
      loggable?: boolean;
      exposeToClient?: boolean;
    }
  ) {
    super(message, code, {
      statusCode: options?.statusCode || HttpStatus.BAD_GATEWAY,
      metadata: options?.metadata,
      cause: options?.cause,
      loggable: options?.loggable ?? true, // External errors should be logged
      exposeToClient: options?.exposeToClient ?? false, // Don't expose external errors to clients
    });
    this.serviceName = options?.serviceName;
    this.originalError = options?.originalError;
  }
}
