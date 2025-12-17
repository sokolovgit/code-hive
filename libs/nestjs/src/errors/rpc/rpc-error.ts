import { BaseError } from '../base/base-error';

/**
 * RPC-specific error class for microservices communication.
 */
export class RpcError extends BaseError {
  /**
   * RPC error code (e.g., 'NOT_FOUND', 'UNAUTHORIZED')
   */
  public readonly rpcCode?: string;

  constructor(
    message: string,
    code: string,
    options?: {
      rpcCode?: string;
      metadata?: Record<string, unknown>;
      cause?: Error;
      loggable?: boolean;
      exposeToClient?: boolean;
    }
  ) {
    super(message, code, {
      metadata: options?.metadata,
      cause: options?.cause,
      loggable: options?.loggable,
      exposeToClient: options?.exposeToClient,
    });
    this.rpcCode = options?.rpcCode;
  }

  /**
   * Get error payload for RPC transport
   */
  getRpcError(): { code: string; message: string; metadata?: Record<string, unknown> } {
    return {
      code: this.rpcCode || this.code,
      message: this.message,
      ...(this.metadata && { metadata: this.metadata }),
    };
  }
}
