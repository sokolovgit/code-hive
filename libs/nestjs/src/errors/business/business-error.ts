import { HttpStatus } from '@nestjs/common';
import { BaseError } from '../base/base-error';

/**
 * Business logic error class.
 * Used for domain-specific business rule violations.
 */
export class BusinessError extends BaseError {
  constructor(
    message: string,
    code: string,
    options?: {
      statusCode?: number;
      metadata?: Record<string, unknown>;
      cause?: Error;
      loggable?: boolean;
      exposeToClient?: boolean;
    }
  ) {
    super(message, code, {
      statusCode: options?.statusCode || HttpStatus.BAD_REQUEST,
      metadata: options?.metadata,
      cause: options?.cause,
      loggable: options?.loggable ?? false, // Business errors are usually expected, less logging
      exposeToClient: options?.exposeToClient ?? true,
    });
  }
}
