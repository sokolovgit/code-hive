import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Inject, Optional } from '@nestjs/common';
import { Request, Response } from 'express';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

import { uuid } from '../../utils';
import { extractTraceContext, getStatusCategory, getTimeBucket } from '../logger.context';
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
  private readonly cls: ClsService;

  constructor(
    @Inject(LoggerService) loggerService: LoggerService,
    @Inject(ClsService) clsService: ClsService,
    @Optional() private readonly options: HttpLoggingInterceptorOptions = {}
  ) {
    this.logger = loggerService;
    this.cls = clsService;
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
    const requestId = requestIdStr || uuid();

    // Extract trace context
    const traceContext = extractTraceContext(request.headers);

    // Generate span ID if not present
    const spanId = traceContext.spanId || uuid();

    // Add request ID and trace context to response headers
    response.setHeader('x-request-id', requestId);
    if (traceContext.traceId) {
      response.setHeader('x-trace-id', traceContext.traceId);
    }
    response.setHeader('x-span-id', spanId);

    // Set context in CLS for automatic inclusion in all logs
    const user = (request as Request & { user?: { id?: string; userId?: string; role?: string } })
      .user;
    const userId = user?.id || user?.userId;
    const userRole = user?.role;

    const loggerCtx = {
      requestId,
      userId,
      userRole,
      component: 'http',
      ...traceContext,
      spanId,
    };

    // Set context in CLS
    // Note: CLS middleware already creates a context for HTTP requests,
    // so we just set values directly without using loggerContext.run()
    Object.entries(loggerCtx).forEach(([key, value]) => {
      if (value !== undefined) {
        this.cls.set(key, value);
      }
    });

    // Execute the request handler - CLS context is already active from middleware
    return (() => {
      // Request log
      const requestLog: Record<string, unknown> = {
        method: request.method,
        url: request.url,
        path: request.path,
        ...(request.route?.path && { route: request.route.path }),
        ip: request.ip || request.socket.remoteAddress,
        userAgent: request.headers['user-agent'],
        httpVersion: request.httpVersion,
        protocol: request.protocol,
        host: request.get('host'),
        referer: request.get('referer'),
        origin: request.get('origin'),
        contentType: request.get('content-type'),
        contentLength: request.get('content-length')
          ? parseInt(request.get('content-length')!, 10)
          : undefined,
        startTime,
        ...(logHeaders && { headers: this.sanitizeObject(request.headers) }),
        ...(logQuery &&
          request.query &&
          Object.keys(request.query).length > 0 && {
            query: this.sanitizeObject(request.query),
          }),
        ...(request.params &&
          Object.keys(request.params).length > 0 && {
            params: request.params,
          }),
        ...(request.cookies &&
          Object.keys(request.cookies).length > 0 && {
            cookies: this.sanitizeObject(request.cookies),
          }),
        ...(logRequestBody &&
          request.body &&
          typeof request.body === 'object' &&
          Object.keys(request.body).length > 0 && {
            body: this.truncateBody(request.body, maxBodyLength),
          }),
      };

      const requestMessage = `-> ${request.method} ${request.path || request.url}`;
      this.logger.info(requestMessage, requestLog, 'HTTP');

      return next.handle().pipe(
        tap((data: unknown) => {
          const duration = Date.now() - startTime;
          const statusCategory = getStatusCategory(response.statusCode);
          const responseTimeBucket = getTimeBucket(duration);

          const responseLog: Record<string, unknown> = {
            method: request.method,
            url: request.url,
            path: request.path,
            statusCode: response.statusCode,
            statusCategory,
            success: response.statusCode < 400,
            responseTime: `${duration}ms`,
            responseTimeMs: duration,
            responseTimeBucket,
            startTime,
            endTime: Date.now(),
            ip: request.ip || request.socket.remoteAddress,
            userAgent: request.headers['user-agent'],
            responseSize: response.get('content-length')
              ? parseInt(response.get('content-length')!, 10)
              : undefined,
            contentType: response.get('content-type'),
            ...(logHeaders && {
              requestHeaders: this.sanitizeObject(request.headers),
              responseHeaders: response.getHeaders(),
            }),
            ...(request.cookies &&
              Object.keys(request.cookies).length > 0 && {
                requestCookies: this.sanitizeObject(request.cookies),
              }),
          };

          if (logResponseBody && data) {
            responseLog.responseBody = this.truncateBody(data, maxBodyLength);
          }

          const logMessage = `<- ${request.method} ${request.path || request.url} ${response.statusCode} - ${duration}ms`;
          this.logger.info(logMessage, responseLog, 'HTTP');
        }),
        catchError((error: unknown) => {
          // Don't log errors here - let the ExceptionLoggingFilter handle all error logging
          // This prevents duplicate logs and ensures consistent error handling
          // Just rethrow the error so the exception filter can catch it
          throw error;
        })
      );
    })();
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
      'session',
      'set-cookie',
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
