import { Injectable, Inject, OnModuleDestroy, Optional } from '@nestjs/common';
import { trace, Tracer, context, Span, SpanStatusCode, SpanKind } from '@opentelemetry/api';
import { ClsService } from 'nestjs-cls';

import { LoggerContextService } from '../logger';

import { TELEMETRY_TRACER } from './telemetry.constants';

/**
 * Telemetry Service
 * Provides methods for manual instrumentation and span management
 */
@Injectable()
export class TelemetryService implements OnModuleDestroy {
  private readonly tracer: Tracer;

  constructor(
    @Inject(TELEMETRY_TRACER) tracer: Tracer,
    @Optional() private readonly loggerContext?: LoggerContextService,
    @Optional() private readonly cls?: ClsService
  ) {
    this.tracer = tracer;
  }

  /**
   * Get the current active span
   */
  getActiveSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  /**
   * Get the current trace ID
   */
  getTraceId(): string | undefined {
    const span = this.getActiveSpan();
    if (!span) {
      return undefined;
    }
    const spanContext = span.spanContext();
    return spanContext.traceId;
  }

  /**
   * Get the current span ID
   */
  getSpanId(): string | undefined {
    const span = this.getActiveSpan();
    if (!span) {
      return undefined;
    }
    const spanContext = span.spanContext();
    return spanContext.spanId;
  }

  /**
   * Start a new span and execute a function within it
   * Automatically handles span lifecycle and error recording
   */
  async startSpan<T>(
    name: string,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, string | number | boolean>;
      links?: Array<{ traceId: string; spanId: string }>;
    },
    fn?: (span: Span) => Promise<T> | T
  ): Promise<T> {
    const span = this.tracer.startSpan(name, {
      kind: options?.kind,
      attributes: options?.attributes,
      links: options?.links?.map((link) => ({
        context: {
          traceId: link.traceId,
          spanId: link.spanId,
          traceFlags: 1,
        },
      })),
    });

    // Update logger context with trace/span IDs if CLS is available
    if (this.cls) {
      const traceId = span.spanContext().traceId;
      const spanId = span.spanContext().spanId;
      const parentSpanId = this.getActiveSpan()?.spanContext().spanId;

      // Set trace context in CLS
      this.cls.set('traceId', traceId);
      this.cls.set('spanId', spanId);
      if (parentSpanId) {
        this.cls.set('parentSpanId', parentSpanId);
      }
    }

    return context.with(trace.setSpan(context.active(), span), async () => {
      try {
        if (fn) {
          const result = await fn(span);
          span.setStatus({ code: SpanStatusCode.OK });
          return result;
        }
        return undefined as T;
      } catch (error) {
        span.recordException(error as Error);
        span.setStatus({
          code: SpanStatusCode.ERROR,
          message: error instanceof Error ? error.message : String(error),
        });
        throw error;
      } finally {
        span.end();
      }
    });
  }

  /**
   * Add an event to the current active span
   */
  addEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
    const span = this.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Set attributes on the current active span
   */
  setAttributes(attributes: Record<string, string | number | boolean>): void {
    const span = this.getActiveSpan();
    if (span) {
      Object.entries(attributes).forEach(([key, value]) => {
        span.setAttribute(key, value);
      });
    }
  }

  /**
   * Get the underlying OpenTelemetry Tracer
   */
  getTracer(): Tracer {
    return this.tracer;
  }

  onModuleDestroy(): void {
    // Cleanup if needed
  }
}
