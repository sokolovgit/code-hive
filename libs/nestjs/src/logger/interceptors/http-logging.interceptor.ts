import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Inject, Optional } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

import { loggerContext } from '../logger.context';
import { LoggerService } from '../logger.service';

export interface HttpLoggingInterceptorOptions {
  /**
   * Log request body
   * @default true
   */
  logRequestBody?: boolean;
  /**
   * Log response body
   * @default false (can be verbose)
   */
  logResponseBody?: boolean;
  /**
   * Log query parameters
   * @default true
   */
  logQuery?: boolean;
  /**
   * Log request headers
   * @default false (can contain sensitive data)
   */
  logHeaders?: boolean;
  /**
   * Maximum length of body to log (to avoid huge payloads)
   * @default 1000
   */
  maxBodyLength?: number;
  /**
   * Skip logging for these paths (e.g., health checks)
   */
  skipPaths?: string[];
  /**
   * Skip logging for these HTTP methods
   */
  skipMethods?: string[];
}

@Injectable()
export class HttpLoggingInterceptor implements NestInterceptor {
  private readonly logger: LoggerService;

  constructor(
    @Inject(LoggerService) loggerService: LoggerService,
    @Optional() private readonly options: HttpLoggingInterceptorOptions = {}
  ) {
    this.logger = loggerService;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    const {
      logRequestBody = true,
      logResponseBody = false,
      logQuery = true,
      logHeaders = false,
      maxBodyLength = 1000,
      skipPaths = ['/health', '/metrics'],
      skipMethods = [],
    } = this.options;

    // Skip logging for specific paths or methods
    if (
      skipPaths.some((path) => request.path.includes(path)) ||
      skipMethods.includes(request.method)
    ) {
      return next.handle();
    }

    const startTime = Date.now();

    // Handle header type (can be string or string[])
    const requestIdHeader = request.headers['x-request-id'] || request.headers['x-correlation-id'];
    const requestIdStr = Array.isArray(requestIdHeader) ? requestIdHeader[0] : requestIdHeader;
    const requestId =
      requestIdStr || `req-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    // Add request ID to response headers
    response.setHeader('x-request-id', requestId);

    // Set context in AsyncLocalStorage for automatic inclusion in all logs
    const user = (request as Request & { user?: { id?: string; userId?: string } }).user;
    const userId = user?.id || user?.userId;

    return loggerContext.run(
      {
        requestId,
        userId,
        component: 'http',
      },
      () => {
        const requestLog: Record<string, unknown> = {
          method: request.method,
          url: request.url,
          path: request.path,
          route: request.route?.path,
          ip: request.ip || request.socket.remoteAddress,
          userAgent: request.headers['user-agent'],
          ...(logQuery &&
            request.query &&
            Object.keys(request.query).length > 0 && {
              query: this.sanitizeObject(request.query),
            }),
          ...(logHeaders && { headers: this.sanitizeObject(request.headers) }),
          ...(logRequestBody &&
            request.body &&
            typeof request.body === 'object' &&
            Object.keys(request.body).length > 0 && {
              body: this.truncateBody(request.body, maxBodyLength),
            }),
        };

        this.logger.info('Incoming HTTP request', requestLog);

        return next.handle().pipe(
          tap((data: unknown) => {
            const duration = Date.now() - startTime;
            const responseLog: Record<string, unknown> = {
              method: request.method,
              url: request.url,
              path: request.path,
              statusCode: response.statusCode,
              duration: `${duration}ms`,
            };

            if (logResponseBody && data) {
              responseLog.responseBody = this.truncateBody(data, maxBodyLength);
            }

            if (response.statusCode >= 400) {
              this.logger.warn(`HTTP ${request.method} ${request.path} - ${response.statusCode}`);
            } else {
              this.logger.info(
                `HTTP ${request.method} ${request.path} - ${response.statusCode}`,
                responseLog
              );
            }
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

            const errorLog: Record<string, unknown> = {
              method: request.method,
              url: request.url,
              path: request.path,
              statusCode: response.statusCode || 500,
              duration: `${duration}ms`,
              error: errorInfo,
            };

            this.logger.error(
              `HTTP ${request.method} ${request.path} - Error`,
              undefined,
              'HttpError'
            );
            this.logger.info('HTTP error details', errorLog);

            throw error;
          })
        );
      }
    );
  }

  private sanitizeObject(obj: Record<string, unknown>): Record<string, unknown> {
    const sensitiveKeys = [
      'password',
      'token',
      'authorization',
      'secret',
      'apiKey',
      'apikey',
      'cookie',
    ];
    const sanitized = { ...obj };

    for (const key in sanitized) {
      if (sensitiveKeys.some((sensitive) => key.toLowerCase().includes(sensitive.toLowerCase()))) {
        sanitized[key] = '[REDACTED]';
      }
    }

    return sanitized;
  }

  private truncateBody(body: unknown, maxLength: number): unknown {
    if (!body || typeof body !== 'object') {
      return body;
    }

    const bodyStr = JSON.stringify(body);
    if (bodyStr.length <= maxLength) {
      return body;
    }

    return {
      ...(body as Record<string, unknown>),
      _truncated: true,
      _originalLength: bodyStr.length,
      _preview: bodyStr.substring(0, maxLength) + '...',
    };
  }
}
