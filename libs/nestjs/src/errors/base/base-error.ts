/**
 * Base error class for all custom errors in the application.
 * Provides common properties and methods for error handling.
 */
export abstract class BaseError extends Error {
  /**
   * Error code for programmatic error identification
   */
  public readonly code: string;

  /**
   * HTTP status code (if applicable)
   */
  public readonly statusCode?: number;

  /**
   * Additional metadata for error context
   */
  public readonly metadata?: Record<string, unknown>;

  /**
   * Timestamp when the error was created
   */
  public readonly timestamp: Date;

  /**
   * Whether this error should be logged
   */
  public readonly loggable: boolean;

  /**
   * Whether this error should be exposed to clients
   */
  public readonly exposeToClient: boolean;

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
    super(message, { cause: options?.cause });

    this.name = this.constructor.name;
    this.code = code;
    this.statusCode = options?.statusCode;
    this.metadata = options?.metadata;
    this.timestamp = new Date();
    this.loggable = options?.loggable ?? true;
    this.exposeToClient = options?.exposeToClient ?? true;

    // Maintains proper stack trace for where our error was thrown (only available on V8)
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }

  /**
   * Convert error to a plain object for logging/serialization
   */
  toJSON(): Record<string, unknown> {
    const result: Record<string, unknown> = {
      name: this.name,
      code: this.code,
      message: this.message,
      statusCode: this.statusCode,
      metadata: this.metadata,
      timestamp: this.timestamp.toISOString(),
      stack: this.stack,
    };

    if (this.cause) {
      result.cause = this.cause instanceof Error ? this.cause.message : this.cause;
    }

    return result;
  }

  /**
   * Get error details safe for client exposure (HTTP context)
   */
  getClientSafeError(): {
    code: string;
    message: string;
    statusCode?: number;
    metadata?: Record<string, unknown>;
  } {
    return {
      code: this.code,
      message: this.exposeToClient ? this.message : 'An error occurred',
      ...(this.statusCode && { statusCode: this.statusCode }),
      ...(this.exposeToClient && this.metadata && { metadata: this.metadata }),
    };
  }

  /**
   * Get error payload for RPC transport (excludes HTTP statusCode)
   */
  getRpcError(): {
    code: string;
    message: string;
    metadata?: Record<string, unknown>;
  } {
    return {
      code: this.code,
      message: this.exposeToClient ? this.message : 'An error occurred',
      ...(this.exposeToClient && this.metadata && { metadata: this.metadata }),
    };
  }
}
