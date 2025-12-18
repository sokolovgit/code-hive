import { HttpStatus } from '@nestjs/common';

import { BaseError } from '../base/base-error';

/**
 * Authentication and authorization error class.
 */
export class AuthError extends BaseError {
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
      statusCode: options?.statusCode || HttpStatus.UNAUTHORIZED,
      metadata: options?.metadata,
      cause: options?.cause,
      loggable: options?.loggable ?? true, // Auth errors should be logged for security
      exposeToClient: options?.exposeToClient ?? true,
    });
  }
}
