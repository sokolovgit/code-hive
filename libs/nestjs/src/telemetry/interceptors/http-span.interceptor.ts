import {
  Inject,
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
  Optional,
} from '@nestjs/common';
import { trace } from '@opentelemetry/api';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';

import { TELEMETRY_OPTIONS } from '../telemetry.constants';
import { TelemetryModuleOptions } from '../telemetry.types';

/**
 * HTTP Span Interceptor
 * Captures HTTP response headers and bodies and adds them to the active OpenTelemetry span.
 * This complements the HTTP instrumentation hooks which can't easily access response data.
 */
@Injectable()
export class HttpSpanInterceptor implements NestInterceptor {
  constructor(
    @Optional() @Inject(TELEMETRY_OPTIONS) private readonly options?: TelemetryModuleOptions
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Only handle HTTP contexts
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();

    // Get HTTP instrumentation options
    const httpConfig = this.options?.instrumentation?.http;
    const httpOptions = typeof httpConfig === 'object' ? httpConfig : {};
    const captureHeaders = httpOptions.captureHeaders !== false; // Default: true
    const captureBodies = httpOptions.captureBodies === true; // Default: false
    const maxBodySize = httpOptions.maxBodySize || 10000; // Default: 10KB
    const ignorePaths = httpOptions.ignorePaths || ['/health', '/metrics', '/healthz', '/ready'];

    // Check if we should skip this path
    const shouldIgnore = ignorePaths.some((path) => request.path.includes(path));
    if (shouldIgnore && !captureBodies) {
      return next.handle();
    }

    // Helper to safely capture body
    const captureBody = (body: unknown, maxSize: number): string | undefined => {
      if (!body) return undefined;

      try {
        let bodyStr: string;
        if (typeof body === 'string') {
          bodyStr = body;
        } else if (Buffer.isBuffer(body)) {
          bodyStr = body.toString('utf-8');
        } else if (typeof body === 'object') {
          bodyStr = JSON.stringify(body);
        } else {
          bodyStr = String(body);
        }

        if (bodyStr.length > maxSize) {
          return `${bodyStr.substring(0, maxSize)}... [truncated, original size: ${bodyStr.length} bytes]`;
        }
        return bodyStr;
      } catch {
        return '[unable to serialize body]';
      }
    };

    return next.handle().pipe(
      tap((data: unknown) => {
        // Get the active span (created by HTTP instrumentation)
        // The HTTP instrumentation creates a span for each request, which should be active here
        const activeSpan = trace.getActiveSpan();
        if (!activeSpan) {
          return;
        }

        // Capture response headers
        if (captureHeaders) {
          try {
            const headers = response.getHeaders();
            if (headers && Object.keys(headers).length > 0) {
              Object.keys(headers).forEach((key) => {
                const value = headers[key];
                if (value !== undefined && value !== null) {
                  activeSpan.setAttribute(
                    `http.response.header.${key.toLowerCase()}`,
                    Array.isArray(value) ? value.join(', ') : String(value)
                  );
                }
              });
            }
          } catch {
            // Silently fail if headers can't be accessed
          }
        }

        // Capture response body
        if (captureBodies && !shouldIgnore && data !== undefined) {
          const bodyStr = captureBody(data, maxBodySize);
          if (bodyStr) {
            activeSpan.setAttribute('http.response.body', bodyStr);
          }
        }
      })
    );
  }
}
