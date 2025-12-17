import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Inject,
} from '@nestjs/common';
import { Request, Response } from 'express';
import { RpcException } from '@nestjs/microservices';
import { throwError } from 'rxjs';
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

    const status =
      exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;

    const requestId =
      request.headers['x-request-id'] || request.headers['x-correlation-id'] || `req-${Date.now()}`;

    const errorResponse =
      exception instanceof HttpException
        ? exception.getResponse()
        : {
            statusCode: status,
            message: 'Internal server error',
          };

    const errorInfo: Record<string, unknown> = {
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

    if (exception instanceof Error && exception.cause) {
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

    // Log at appropriate level using Pino logger directly for structured logging
    const pinoLogger = logger.getPinoLogger().child({ context: 'HttpException' });
    if (status >= 500) {
      pinoLogger.error(errorLog, 'HTTP exception (5xx)');
    } else if (status >= 400) {
      pinoLogger.warn(errorLog, 'HTTP exception (4xx)');
    } else {
      pinoLogger.info(errorLog, 'HTTP exception');
    }

    response.status(status).json(errorResponse);
  }

  private handleRpcException(exception: unknown, host: ArgumentsHost, logger: LoggerService) {
    const ctx = host.switchToRpc();
    const data = ctx.getData();
    const pattern = ctx.getContext()?.pattern || 'unknown';

    const errorLog: Record<string, unknown> = {
      pattern,
      transport: ctx.getContext()?.transport || 'unknown',
      ...(data && { requestData: data }),
      error: (() => {
        const errorInfo: Record<string, unknown> = {
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
          errorInfo.cause = exception.cause;
        }
        return errorInfo;
      })(),
      timestamp: new Date().toISOString(),
    };

    logger.getPinoLogger().child({ context: 'RpcException' }).error(errorLog, 'RPC exception');

    if (exception instanceof RpcException) {
      return throwError(() => exception.getError());
    }

    return throwError(() => exception);
  }

  private handleWsException(exception: unknown, host: ArgumentsHost, logger: LoggerService) {
    const ctx = host.switchToWs();
    const client = ctx.getClient();
    const data = ctx.getData();
    const pattern = ctx.getPattern() || 'unknown';

    const errorLog: Record<string, unknown> = {
      event: pattern,
      clientId: (client as { id?: string })?.id,
      ...(data && { messageData: data }),
      error: (() => {
        const errorInfo: Record<string, unknown> = {
          name: exception instanceof Error ? exception.name : 'UnknownError',
          message:
            exception instanceof Error ? exception.message : 'Unknown WebSocket error occurred',
          ...(exception instanceof Error && exception.stack && { stack: exception.stack }),
        };
        if (exception instanceof Error && exception.cause) {
          errorInfo.cause = exception.cause;
        }
        return errorInfo;
      })(),
      timestamp: new Date().toISOString(),
    };

    logger
      .getPinoLogger()
      .child({ context: 'WebSocketException' })
      .error(errorLog, 'WebSocket exception');
  }

  private handleGenericException(exception: unknown, logger: LoggerService) {
    const errorLog: Record<string, unknown> = {
      error: (() => {
        const errorInfo: Record<string, unknown> = {
          name: exception instanceof Error ? exception.name : 'UnknownError',
          message: exception instanceof Error ? exception.message : 'Unknown error occurred',
          ...(exception instanceof Error && exception.stack && { stack: exception.stack }),
        };
        if (exception instanceof Error && exception.cause) {
          errorInfo.cause = exception.cause;
        }
        return errorInfo;
      })(),
      timestamp: new Date().toISOString(),
    };

    logger
      .getPinoLogger()
      .child({ context: 'UnhandledException' })
      .error(errorLog, 'Unhandled exception');
  }
}
