import { Inject, Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Request, Response } from 'express';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

import { TELEMETRY_OPTIONS } from '../telemetry.constants';
import { TelemetryService } from '../telemetry.service';
import { TelemetryModuleOptions } from '../telemetry.types';

/**
 * HTTP Metrics Interceptor
 * Collects HTTP metrics: request count, latency, status codes, etc.
 */
@Injectable()
export class MetricsInterceptor implements NestInterceptor {
  private readonly httpRequestDuration: ReturnType<TelemetryService['createHistogram']>;
  private readonly httpRequestCount: ReturnType<TelemetryService['createCounter']>;

  constructor(
    private readonly telemetry: TelemetryService,
    @Inject(TELEMETRY_OPTIONS) private readonly options: TelemetryModuleOptions
  ) {
    // Create metrics
    this.httpRequestDuration = this.telemetry.createHistogram('http_request_duration_ms', {
      description: 'HTTP request duration in milliseconds',
      unit: 'ms',
    });

    this.httpRequestCount = this.telemetry.createCounter('http_request_total', {
      description: 'Total number of HTTP requests',
    });
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    // Only handle HTTP contexts
    if (context.getType() !== 'http') {
      return next.handle();
    }

    const request = context.switchToHttp().getRequest<Request>();
    const response = context.switchToHttp().getResponse<Response>();
    const startTime = Date.now();

    return next.handle().pipe(
      tap(() => {
        const duration = Date.now() - startTime;
        const method = request.method;
        const route = request.route?.path || request.path;
        const statusCode = response.statusCode;

        // Record duration
        this.httpRequestDuration.record(duration, {
          method,
          route: route || 'unknown',
          status_code: statusCode.toString(),
        });

        // Increment counter
        this.httpRequestCount.add(1, {
          method,
          route: route || 'unknown',
          status_code: statusCode.toString(),
        });
      }),
      catchError((error) => {
        const duration = Date.now() - startTime;
        const method = request.method;
        const route = request.route?.path || request.path;
        const statusCode = error.status || 500;

        // Record duration for errors
        this.httpRequestDuration.record(duration, {
          method,
          route: route || 'unknown',
          status_code: statusCode.toString(),
        });

        // Increment error counter
        this.httpRequestCount.add(1, {
          method,
          route: route || 'unknown',
          status_code: statusCode.toString(),
        });

        throw error;
      })
    );
  }
}
