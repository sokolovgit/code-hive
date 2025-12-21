import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { context as otelContext, trace, SpanKind, SpanStatusCode } from '@opentelemetry/api';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

import { TelemetryService } from '../telemetry.service';

/**
 * Automatic Trace Interceptor
 * Automatically traces ALL service methods - no decorators needed!
 * Intelligently extracts method name, class name, and arguments.
 */
@Injectable()
export class TraceInterceptor implements NestInterceptor {
  constructor(private readonly telemetry: TelemetryService) {}

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

    // Generate span name: ClassName.methodName
    const spanName = `${className}.${methodName}`;

    // Automatically extract useful attributes from method arguments
    const args = executionContext.getArgs();
    const attributes: Record<string, string | number | boolean> = {
      'code.function': methodName,
      'code.namespace': className,
    };

    // Intelligently extract attributes from arguments
    args.forEach((arg, index) => {
      if (arg === null || arg === undefined) {
        return;
      }

      // Handle string/number/boolean primitives
      if (typeof arg === 'string' || typeof arg === 'number' || typeof arg === 'boolean') {
        // Use meaningful attribute names for common patterns
        if (typeof arg === 'string' && arg.length < 100) {
          // Common ID patterns
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
      }
      // Handle objects - extract common fields
      else if (typeof arg === 'object' && !Array.isArray(arg) && !(arg instanceof Date)) {
        Object.entries(arg).forEach(([key, value]) => {
          // Only include safe, small values
          if (typeof value === 'string' && value.length < 100) {
            attributes[`arg${index}.${key}`] = value;
          } else if (typeof value === 'number' || typeof value === 'boolean') {
            attributes[`arg${index}.${key}`] = value;
          }
        });
      }
    });

    // Create span automatically
    const span = this.telemetry.getTracer().startSpan(spanName, {
      kind: SpanKind.INTERNAL,
      attributes,
    });

    // Set span as active in context
    const activeContext = trace.setSpan(otelContext.active(), span);

    return otelContext.with(activeContext, () => {
      return next.handle().pipe(
        tap((result) => {
          // Automatically add result metadata
          if (result !== undefined) {
            const resultType = Array.isArray(result) ? 'array' : typeof result;
            span.setAttribute('result.type', resultType);
            if (Array.isArray(result)) {
              span.setAttribute('result.length', result.length);
            }
          }
          span.setStatus({ code: SpanStatusCode.OK });
          span.end();
        }),
        catchError((error) => {
          span.recordException(error);
          span.setStatus({
            code: SpanStatusCode.ERROR,
            message: error instanceof Error ? error.message : String(error),
          });
          span.end();
          throw error;
        })
      );
    });
  }
}
