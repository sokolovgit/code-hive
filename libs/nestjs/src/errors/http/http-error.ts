import { HttpStatus } from '@nestjs/common';

import { BaseError } from '../base/base-error';

/**
 * HTTP-specific error class.
 * Extends BaseError with HTTP status code support.
 */
export class HttpError extends BaseError {
  constructor(
    message: string,
    statusCode: number = HttpStatus.INTERNAL_SERVER_ERROR,
    options?: {
      code?: string;
      metadata?: Record<string, unknown>;
      cause?: Error;
      loggable?: boolean;
      exposeToClient?: boolean;
    }
  ) {
    super(message, options?.code || `HTTP_${statusCode}`, {
      statusCode,
      metadata: options?.metadata,
      cause: options?.cause,
      loggable: options?.loggable,
      exposeToClient: options?.exposeToClient,
    });
  }
}
