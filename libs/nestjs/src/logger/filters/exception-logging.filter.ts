import { uuid } from '@code-hive/nestjs/utils';
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { RpcException } from '@nestjs/microservices';
import { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { throwError } from 'rxjs';

import { BaseError } from '../../errors';
import { getStatusCategory } from '../logger.context';
import { LoggerService } from '../logger.service';

@Catch()
export class ExceptionLoggingFilter implements ExceptionFilter {
  constructor(
    @Inject(LoggerService) private readonly logger: LoggerService,
    @Inject(ClsService) private readonly cls: ClsService
  ) {}

  catch(exception: unknown, host: ArgumentsHost) {
    // Determine context type
    const type = host.getType();

    if (type === 'http') {
      this.handleHttpException(exception, host, this.logger);
    } else if (type === 'rpc') {
      return this.handleRpcException(exception, host, this.logger);
    } else if (type === 'ws') {
      this.handleWsException(exception, host, this.logger);
    } else {
      // Fallback for unknown context types
      this.handleGenericException(exception, this.logger);
    }
  }

  private handleHttpException(exception: unknown, host: ArgumentsHost, logger: LoggerService) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    if (exception instanceof BaseError) {
      exception.setTransportIfUnset('http');
    }

    // Determine status code - prioritize custom errors, then HttpException, then default
    const status =
      exception instanceof BaseError && exception.statusCode
        ? exception.statusCode
        : exception instanceof HttpException
          ? exception.getStatus()
          : HttpStatus.INTERNAL_SERVER_ERROR;

    // Get requestId from CLS context (set by HttpLoggingInterceptor) or fallback to headers
    const requestId =
      this.cls.get('requestId') ||
      request.headers['x-request-id'] ||
      request.headers['x-correlation-id'] ||
      uuid();

    // Build error response - use custom error's client-safe format if available
    let errorResponse: Record<string, unknown>;
    if (exception instanceof BaseError) {
      errorResponse = {
        statusCode: status,
        ...exception.getClientSafeError(),
      };
    } else if (exception instanceof HttpException) {
      errorResponse =
        typeof exception.getResponse() === 'object'
          ? (exception.getResponse() as Record<string, unknown>)
          : {
              statusCode: status,
              message: exception.message,
            };
    } else {
      errorResponse = {
        statusCode: status,
        message: 'Internal server error',
      };
    }

    // Build error info for logging - use custom error's toJSON if available
    const errorInfo: Record<string, unknown> =
      exception instanceof BaseError
        ? exception.toJSON()
        : {
            name: exception instanceof Error ? exception.name : 'UnknownError',
            message:
              exception instanceof HttpException
                ? exception.message
                : exception instanceof Error
                  ? exception.message
                  : 'Unknown error occurred',
            ...(exception instanceof Error &&
              exception.stack && {
                stack: exception.stack
                  .split('\n')
                  .map((line) => line.trim())
                  .filter(Boolean),
              }),
            ...(exception instanceof HttpException && {
              response: errorResponse,
            }),
          };

    if (exception instanceof Error && exception.cause && !(exception instanceof BaseError)) {
      errorInfo.cause = exception.cause;
    }

    const statusCategory = getStatusCategory(status);
    const errorLog: Record<string, unknown> = {
      requestId,
      method: request.method,
      url: request.url,
      path: request.path,
      statusCode: status,
      statusCategory,
      ip: request.ip || request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
      error: errorInfo,
      timestamp: new Date().toISOString(),
    };

    // Log at appropriate level - single log entry with message and all details
    const shouldLog = !(exception instanceof BaseError) || exception.loggable;
    if (shouldLog) {
      const errorMessage = exception instanceof Error ? exception.message : 'HTTP exception';

      // Single log entry with message and all details at appropriate level
      if (status >= 500) {
        logger.error(errorMessage, errorLog, 'GlobalExceptionFilter');
      } else if (status >= 400) {
        // 4xx errors are client errors, log as warn
        logger.warn(errorMessage, errorLog, 'GlobalExceptionFilter');
      } else {
        logger.info(errorMessage, errorLog, 'GlobalExceptionFilter');
      }
    }

    response.status(status).json(errorResponse);
  }

  private handleRpcException(exception: unknown, host: ArgumentsHost, logger: LoggerService) {
    const ctx = host.switchToRpc();
    const data = ctx.getData();
    const pattern = ctx.getContext()?.pattern || 'unknown';

    if (exception instanceof BaseError) {
      exception.setTransportIfUnset('rpc');
    }

    // Build error info for logging - use custom error's toJSON if available
    const errorInfo: Record<string, unknown> =
      exception instanceof BaseError
        ? exception.toJSON()
        : (() => {
            const info: Record<string, unknown> = {
              name: exception instanceof Error ? exception.name : 'UnknownError',
              message:
                exception instanceof RpcException
                  ? exception.getError()
                  : exception instanceof Error
                    ? exception.message
                    : 'Unknown RPC error occurred',
              ...(exception instanceof Error &&
                exception.stack && {
                  stack: exception.stack
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean),
                }),
            };
            if (exception instanceof Error && exception.cause) {
              info.cause = exception.cause;
            }
            return info;
          })();

    const errorLog: Record<string, unknown> = {
      pattern,
      transport: ctx.getContext()?.transport || 'unknown',
      ...(data && { requestData: data }),
      error: errorInfo,
      timestamp: new Date().toISOString(),
    };

    // Log if error is loggable - single log entry with message and details
    const shouldLog = !(exception instanceof BaseError) || exception.loggable;
    if (shouldLog) {
      const errorMessage = exception instanceof Error ? exception.message : 'RPC exception';
      logger.error(errorMessage, errorLog, 'RpcException');
    }

    // Return appropriate error format
    if (exception instanceof RpcException) {
      return throwError(() => exception.getError());
    }

    // For any BaseError in RPC context,
    // use getRpcError() which excludes HTTP statusCode
    if (exception instanceof BaseError) {
      return throwError(() => exception.getRpcError());
    }

    return throwError(() => exception);
  }

  private handleWsException(exception: unknown, host: ArgumentsHost, logger: LoggerService) {
    const ctx = host.switchToWs();
    const client = ctx.getClient();
    const data = ctx.getData();
    const pattern = ctx.getPattern() || 'unknown';

    if (exception instanceof BaseError) {
      exception.setTransportIfUnset('ws');
    }

    // Build error info for logging - use custom error's toJSON if available
    const errorInfo: Record<string, unknown> =
      exception instanceof BaseError
        ? exception.toJSON()
        : (() => {
            const info: Record<string, unknown> = {
              name: exception instanceof Error ? exception.name : 'UnknownError',
              message:
                exception instanceof Error ? exception.message : 'Unknown WebSocket error occurred',
              ...(exception instanceof Error &&
                exception.stack && {
                  stack: exception.stack
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean),
                }),
            };
            if (exception instanceof Error && exception.cause) {
              info.cause = exception.cause;
            }
            return info;
          })();

    const errorLog: Record<string, unknown> = {
      event: pattern,
      clientId: (client as { id?: string })?.id,
      ...(data && { messageData: data }),
      error: errorInfo,
      timestamp: new Date().toISOString(),
    };

    // Log if error is loggable - single log entry with message and details
    const shouldLog = !(exception instanceof BaseError) || exception.loggable;
    if (shouldLog) {
      const errorMessage = exception instanceof Error ? exception.message : 'WebSocket exception';
      logger.error(errorMessage, errorLog, 'WebSocketException');
    }
  }

  private handleGenericException(exception: unknown, logger: LoggerService) {
    // Build error info for logging - use custom error's toJSON if available
    const errorInfo: Record<string, unknown> =
      exception instanceof BaseError
        ? exception.toJSON()
        : (() => {
            const info: Record<string, unknown> = {
              name: exception instanceof Error ? exception.name : 'UnknownError',
              message: exception instanceof Error ? exception.message : 'Unknown error occurred',
              ...(exception instanceof Error &&
                exception.stack && {
                  stack: exception.stack
                    .split('\n')
                    .map((line) => line.trim())
                    .filter(Boolean),
                }),
            };
            if (exception instanceof Error && exception.cause) {
              info.cause = exception.cause;
            }
            return info;
          })();

    const errorLog: Record<string, unknown> = {
      error: errorInfo,
      timestamp: new Date().toISOString(),
    };

    // Log if error is loggable
    const shouldLog = !(exception instanceof BaseError) || exception.loggable;
    if (shouldLog) {
      logger.error('Unhandled exception', undefined, 'UnhandledException');
      logger.info('Unhandled exception details', errorLog, 'UnhandledException');
    }
  }
}
