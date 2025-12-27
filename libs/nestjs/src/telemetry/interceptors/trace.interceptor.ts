import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

import { SPAN_METADATA_KEY, SpanOptions } from '../decorators/span.decorator';
import { TRACE_METADATA_KEY, TraceOptions } from '../decorators/trace.decorator';
import { TelemetryService } from '../telemetry.service';

/**
 * Automatic Trace Interceptor
 * Automatically traces service methods based on @Trace() or @Span() decorators
 */
@Injectable()
export class TraceInterceptor implements NestInterceptor {
  constructor(
    private readonly telemetry: TelemetryService,
    private readonly reflector: Reflector
  ) {}

  intercept(executionContext: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Skip if it's a controller (HTTP interceptor already handles it)
    const handler = executionContext.getHandler();
    const className = executionContext.getClass().name;

    // Skip controllers, guards, filters, etc. - only trace services
    if (
      className.endsWith('Controller') ||
      className.endsWith('Guard') ||
      className.endsWith('Filter') ||
      className.endsWith('Interceptor') ||
      className.endsWith('Middleware')
    ) {
      return next.handle();
    }

    // Check for @Trace() or @Span() decorator
    const traceOptions = this.reflector.get<TraceOptions | undefined>(TRACE_METADATA_KEY, handler);
    const spanOptions = this.reflector.get<SpanOptions | undefined>(SPAN_METADATA_KEY, handler);

    const options = traceOptions || spanOptions;

    // If no decorator, skip
    if (!options) {
      return next.handle();
    }

    const methodName = handler.name;

    // Skip NestJS lifecycle methods and internal methods
    if (
      methodName.startsWith('onModule') ||
      methodName.startsWith('onApplication') ||
      methodName === 'constructor' ||
      methodName.startsWith('_') ||
      methodName === 'toString' ||
      methodName === 'toJSON'
    ) {
      return next.handle();
    }

    // Generate span name
    const spanName = options.name || `${className}.${methodName}`;

    // Extract attributes from method arguments if requested
    const args = executionContext.getArgs();
    const attributes: Record<string, string | number | boolean> = {
      'code.function': methodName,
      'code.namespace': className,
      ...(options.attributes || {}),
    };

    // Include arguments if requested
    if (options.includeArgs) {
      args.forEach((arg, index) => {
        if (arg === null || arg === undefined) {
          return;
        }

        if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
          if (typeof arg === 'string' && arg.length < 100) {
            if (arg.match(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i)) {
              attributes[`arg${index}.id`] = arg;
            } else if (arg.includes('@')) {
              attributes[`arg${index}.email`] = arg;
            } else {
              attributes[`arg${index}`] = arg;
            }
          } else {
            attributes[`arg${index}`] = arg;
          }
        } else if (typeof arg === 'object' && !Array.isArray(arg) && !(arg instanceof Date)) {
          Object.entries(arg).forEach(([key, value]) => {
            if (typeof value === 'string' && value.length < 100) {
              attributes[`arg${index}.${key}`] = value;
            } else if (typeof value === 'number' || typeof value === 'boolean') {
              attributes[`arg${index}.${key}`] = value;
            }
          });
        }
      });
    }

    // Create span
    return new Observable((subscriber) => {
      this.telemetry
        .startSpan(
          spanName,
          {
            kind: options.kind || SpanKind.INTERNAL,
            attributes,
          },
          async (span) => {
            const result = await new Promise((resolve, reject) => {
              next
                .handle()
                .pipe(
                  tap((data) => {
                    if (options.includeResult && data !== undefined) {
                      const resultType = Array.isArray(data) ? 'array' : typeof data;
                      span.setAttribute('result.type', resultType);
                      if (Array.isArray(data)) {
                        span.setAttribute('result.length', data.length);
                      }
                      span.addEvent('result', { type: resultType });
                    }
                    resolve(data);
                  }),
                  catchError((error) => {
                    span.recordException(error);
                    span.setStatus({
                      code: SpanStatusCode.ERROR,
                      message: error instanceof Error ? error.message : String(error),
                    });
                    reject(error);
                    throw error;
                  })
                )
                .subscribe({
                  next: (value) => {
                    subscriber.next(value);
                  },
                  error: (error) => {
                    subscriber.error(error);
                  },
                  complete: () => {
                    span.setStatus({ code: SpanStatusCode.OK });
                    subscriber.complete();
                  },
                });
            });
            return result;
          }
        )
        .catch((error) => {
          subscriber.error(error);
        });
    });
  }
}
