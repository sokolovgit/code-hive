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
import { throwError } from 'rxjs';

import { BaseError } from '../../errors';
import { LoggerService } from '../logger.service';

@Catch()
export class ExceptionLoggingFilter implements ExceptionFilter {
  constructor(@Inject(LoggerService) private readonly logger: LoggerService) {}

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

    const requestId =
      request.headers['x-request-id'] || request.headers['x-correlation-id'] || `req-${Date.now()}`;

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
            ...(exception instanceof Error && exception.stack && { stack: exception.stack }),
            ...(exception instanceof HttpException && {
              response: errorResponse,
            }),
          };

    if (exception instanceof Error && exception.cause && !(exception instanceof BaseError)) {
      errorInfo.cause = exception.cause;
    }

    const errorLog: Record<string, unknown> = {
      requestId,
      method: request.method,
      url: request.url,
      path: request.path,
      statusCode: status,
      ip: request.ip || request.socket.remoteAddress,
      userAgent: request.headers['user-agent'],
      error: errorInfo,
      timestamp: new Date().toISOString(),
    };

    // Log at appropriate level - respect custom error's loggable flag
    const shouldLog = !(exception instanceof BaseError) || exception.loggable;
    if (shouldLog) {
      const pinoLogger = logger.getPinoLogger().child({ context: 'HttpException' });
      if (status >= 500) {
        pinoLogger.error(errorLog, 'HTTP exception (5xx)');
      } else if (status >= 400) {
        pinoLogger.warn(errorLog, 'HTTP exception (4xx)');
      } else {
        pinoLogger.info(errorLog, 'HTTP exception');
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
              ...(exception instanceof Error && exception.stack && { stack: exception.stack }),
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

    // Log if error is loggable
    const shouldLog = !(exception instanceof BaseError) || exception.loggable;
    if (shouldLog) {
      logger.getPinoLogger().child({ context: 'RpcException' }).error(errorLog, 'RPC exception');
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
              ...(exception instanceof Error && exception.stack && { stack: exception.stack }),
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

    // Log if error is loggable
    const shouldLog = !(exception instanceof BaseError) || exception.loggable;
    if (shouldLog) {
      logger
        .getPinoLogger()
        .child({ context: 'WebSocketException' })
        .error(errorLog, 'WebSocket exception');
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
              ...(exception instanceof Error && exception.stack && { stack: exception.stack }),
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
      logger
        .getPinoLogger()
        .child({ context: 'UnhandledException' })
        .error(errorLog, 'Unhandled exception');
    }
  }
}
