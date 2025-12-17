import { HttpStatus } from '@nestjs/common';
import { BaseError } from '../base/base-error';

/**
 * Data-related error class.
 * Used for database, validation, and data integrity errors.
 */
export class DataError extends BaseError {
  /**
   * Field or property that caused the error
   */
  public readonly field?: string;

  constructor(
    message: string,
    code: string,
    options?: {
      field?: string;
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
      loggable: options?.loggable,
      exposeToClient: options?.exposeToClient ?? true,
    });
    this.field = options?.field;
  }
}
