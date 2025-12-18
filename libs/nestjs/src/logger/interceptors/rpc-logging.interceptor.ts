import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Inject, Optional } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

import { loggerContext } from '../logger.context';
import { LoggerService } from '../logger.service';

export interface RpcLoggingInterceptorOptions {
  /**
   * Log request data
   * @default true
   */
  logRequestData?: boolean;
  /**
   * Log response data
   * @default false
   */
  logResponseData?: boolean;
  /**
   * Maximum length of data to log
   * @default 1000
   */
  maxDataLength?: number;
  /**
   * Skip logging for these patterns
   */
  skipPatterns?: string[];
}

@Injectable()
export class RpcLoggingInterceptor implements NestInterceptor {
  private readonly logger: LoggerService;

  constructor(
    @Inject(LoggerService) loggerService: LoggerService,
    @Optional() private readonly options: RpcLoggingInterceptorOptions = {}
  ) {
    this.logger = loggerService;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const {
      logRequestData = true,
      logResponseData = false,
      maxDataLength = 1000,
      skipPatterns = [],
    } = this.options;

    // Get RPC context (works with NestJS microservices)
    const rpcContext = context.switchToRpc();
    const data = rpcContext.getData();
    const pattern = rpcContext.getContext()?.pattern || context.getClass()?.name || 'unknown';

    // Skip logging for specific patterns
    if (skipPatterns.some((skipPattern) => pattern.includes(skipPattern))) {
      return next.handle();
    }

    const startTime = Date.now();
    const requestId = `rpc-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    return loggerContext.run(
      {
        requestId,
        component: 'rpc',
      },
      () => {
        const requestLog: Record<string, unknown> = {
          pattern,
          transport: rpcContext.getContext()?.transport || 'unknown',
          ...(logRequestData &&
            data && {
              data: this.truncateData(data, maxDataLength),
            }),
        };

        this.logger.info('Incoming RPC request', requestLog);

        return next.handle().pipe(
          tap((responseData: unknown) => {
            const duration = Date.now() - startTime;
            const responseLog: Record<string, unknown> = {
              pattern,
              duration: `${duration}ms`,
            };
            if (logResponseData && responseData) {
              responseLog.responseData = this.truncateData(responseData, maxDataLength);
            }

            this.logger.info('RPC response', responseLog);
          }),
          catchError((error: unknown) => {
            const duration = Date.now() - startTime;
            const errorInfo: Record<string, unknown> = {
              name: error instanceof Error ? error.name : 'UnknownError',
              message: error instanceof Error ? error.message : 'Unknown error',
            };
            if (error instanceof Error && error.stack) {
              errorInfo.stack = error.stack;
            }
            if (error && typeof error === 'object' && 'code' in error) {
              errorInfo.code = (error as { code?: unknown }).code;
            }

            const errorLog: Record<string, unknown> = {
              pattern,
              duration: `${duration}ms`,
              error: errorInfo,
            };

            this.logger.error('RPC error', undefined, 'RpcError');
            this.logger.info('RPC error details', errorLog);

            throw error;
          })
        );
      }
    );
  }

  private truncateData(data: unknown, maxLength: number): unknown {
    if (!data) return data;

    const dataStr = JSON.stringify(data);
    if (dataStr.length <= maxLength) {
      return data;
    }

    return {
      _truncated: true,
      _originalLength: dataStr.length,
      _preview: dataStr.substring(0, maxLength) + '...',
    };
  }
}
