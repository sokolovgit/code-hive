import { Injectable, Inject, OnModuleDestroy } from '@nestjs/common';
import {
  trace,
  Tracer,
  Meter,
  context,
  Span,
  SpanStatusCode,
  SpanKind,
  AttributeValue,
} from '@opentelemetry/api';
import { ClsService } from 'nestjs-cls';

import { LoggerContextService } from '../logger';

import { TELEMETRY_TRACER, TELEMETRY_METER, TELEMETRY_LOGGER } from './telemetry.constants';

/**
 * Telemetry Service
 * Provides methods for manual instrumentation and span/metric/log management
 */
@Injectable()
export class TelemetryService implements OnModuleDestroy {
  private readonly tracer: Tracer;
  private readonly meter: Meter;
  private readonly logger: unknown | null;

  constructor(
    @Inject(TELEMETRY_TRACER) tracer: Tracer,
    @Inject(TELEMETRY_METER) meter: Meter,
    @Inject(TELEMETRY_LOGGER) logger: unknown | null,
    private readonly loggerContext: LoggerContextService,
    private readonly cls: ClsService
  ) {
    this.tracer = tracer;
    this.meter = meter;
    this.logger = logger;
  }

  // ========== Tracing Methods ==========

  /**
   * Get the current active span
   */
  getActiveSpan(): Span | undefined {
    return trace.getActiveSpan();
  }

  /**
   * Get the current trace ID
   * Also syncs to CLS and logger context if available
   */
  getTraceId(): string | undefined {
    const span = this.getActiveSpan();
    if (!span) {
      return undefined;
    }
    const spanContext = span.spanContext();
    const traceId = spanContext.traceId;

    // Sync to CLS and logger context for automatic log correlation
    this.syncTraceContextToLogger();

    return traceId;
  }

  /**
   * Get the current span ID
   * Also syncs to CLS and logger context if available
   */
  getSpanId(): string | undefined {
    const span = this.getActiveSpan();
    if (!span) {
      return undefined;
    }
    const spanContext = span.spanContext();
    const spanId = spanContext.spanId;

    // Sync to CLS and logger context for automatic log correlation
    this.syncTraceContextToLogger();

    return spanId;
  }

  /**
   * Sync current trace context to CLS and logger context
   * This ensures all logs automatically include trace IDs
   */
  private syncTraceContextToLogger(): void {
    const span = this.getActiveSpan();
    if (!span) {
      return;
    }

    const spanContext = span.spanContext();
    const traceId = spanContext.traceId;
    const spanId = spanContext.spanId;
    const parentSpan = trace.getActiveSpan();
    const parentSpanId = parentSpan?.spanContext().spanId;

    // Update CLS with trace context (logger will automatically pick this up)
    this.cls.set('traceId', traceId);
    this.cls.set('spanId', spanId);
    if (parentSpanId) {
      this.cls.set('parentSpanId', parentSpanId);
    }

    // Also update logger context service
    this.loggerContext.set('traceId', traceId);
    this.loggerContext.set('spanId', spanId);
    if (parentSpanId) {
      this.loggerContext.set('parentSpanId', parentSpanId);
    }
  }

  /**
   * Start a new span and execute a function within it
   * Automatically handles span lifecycle and error recording
   */
  async startSpan<T>(
    name: string,
    options?: {
      kind?: SpanKind;
      attributes?: Record<string, AttributeValue>;
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

    // Update logger context with trace/span IDs
    // This ensures all logs automatically include trace context
    const traceId = span.spanContext().traceId;
    const spanId = span.spanContext().spanId;
    const parentSpanId = this.getActiveSpan()?.spanContext().spanId;

    // Set trace context in CLS (logger will automatically pick this up)
    this.cls.set('traceId', traceId);
    this.cls.set('spanId', spanId);
    if (parentSpanId) {
      this.cls.set('parentSpanId', parentSpanId);
    }

    // Also update logger context service
    this.loggerContext.set('traceId', traceId);
    this.loggerContext.set('spanId', spanId);
    if (parentSpanId) {
      this.loggerContext.set('parentSpanId', parentSpanId);
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
  addEvent(name: string, attributes?: Record<string, AttributeValue>): void {
    const span = this.getActiveSpan();
    if (span) {
      span.addEvent(name, attributes);
    }
  }

  /**
   * Set attributes on the current active span
   */
  setAttributes(attributes: Record<string, AttributeValue>): void {
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

  // ========== Metrics Methods ==========

  /**
   * Create a counter metric
   */
  createCounter(name: string, options?: { description?: string; unit?: string }) {
    return this.meter.createCounter(name, options);
  }

  /**
   * Create a histogram metric
   */
  createHistogram(name: string, options?: { description?: string; unit?: string }) {
    return this.meter.createHistogram(name, options);
  }

  /**
   * Create an up-down counter metric
   */
  createUpDownCounter(name: string, options?: { description?: string; unit?: string }) {
    return this.meter.createUpDownCounter(name, options);
  }

  /**
   * Create an observable counter metric
   */
  createObservableCounter(
    name: string,
    options?: { description?: string; unit?: string },
    _callback?: (observable: import('@opentelemetry/api').Observable) => void
  ) {
    return this.meter.createObservableCounter(name, options);
  }

  /**
   * Create an observable gauge metric
   */
  createObservableGauge(
    name: string,
    options?: { description?: string; unit?: string },
    _callback?: (observable: import('@opentelemetry/api').Observable) => void
  ) {
    return this.meter.createObservableGauge(name, options);
  }

  /**
   * Create an observable up-down counter metric
   */
  createObservableUpDownCounter(
    name: string,
    options?: { description?: string; unit?: string },
    _callback?: (observable: import('@opentelemetry/api').Observable) => void
  ) {
    return this.meter.createObservableUpDownCounter(name, options);
  }

  /**
   * Get the underlying OpenTelemetry Meter
   */
  getMeter(): Meter {
    return this.meter;
  }

  // ========== Logs Methods ==========

  /**
   * Emit a log record
   * Note: Logs API support may vary by OpenTelemetry version
   */
  emitLog(severityText: string, body: string, attributes?: Record<string, AttributeValue>): void {
    if (!this.logger) {
      return;
    }

    // Logs API implementation depends on OpenTelemetry version
    // For now, this is a placeholder
    const logRecord = {
      severityText,
      body,
      attributes: {
        ...attributes,
        trace_id: this.getTraceId(),
        span_id: this.getSpanId(),
      },
    };

    // Type assertion for logger - actual implementation depends on version
    (this.logger as { emit?: (record: unknown) => void })?.emit?.(logRecord);
  }

  /**
   * Emit a debug log
   */
  debug(message: string, attributes?: Record<string, AttributeValue>): void {
    this.emitLog('DEBUG', message, attributes);
  }

  /**
   * Emit an info log
   */
  info(message: string, attributes?: Record<string, AttributeValue>): void {
    this.emitLog('INFO', message, attributes);
  }

  /**
   * Emit a warn log
   */
  warn(message: string, attributes?: Record<string, AttributeValue>): void {
    this.emitLog('WARN', message, attributes);
  }

  /**
   * Emit an error log
   */
  error(message: string, error?: Error, attributes?: Record<string, AttributeValue>): void {
    this.emitLog('ERROR', message, {
      ...attributes,
      ...(error && {
        'error.type': error.constructor.name,
        'error.message': error.message,
        'error.stack': error.stack,
      }),
    });
  }

  /**
   * Get the underlying OpenTelemetry Logger
   */
  getLogger(): unknown | null {
    return this.logger;
  }

  onModuleDestroy(): void {
    // Cleanup if needed
  }
}
