import { SetMetadata } from '@nestjs/common';

export const SPAN_METADATA_KEY = 'telemetry:span';

export interface SpanOptions {
  /**
   * Span name (defaults to method name)
   */
  name?: string;

  /**
   * Span kind
   * @default SpanKind.INTERNAL
   */
  kind?: import('@opentelemetry/api').SpanKind;

  /**
   * Additional span attributes
   */
  attributes?: Record<string, string | number | boolean>;

  /**
   * Whether to include method arguments as attributes
   * @default false
   */
  includeArgs?: boolean;

  /**
   * Whether to include return value as event
   * @default false
   */
  includeResult?: boolean;

  /**
   * Whether to record exceptions automatically
   * @default true
   */
  recordException?: boolean;
}

/**
 * @Span() decorator - Automatically creates a span for the method
 *
 * @example
 * ```typescript
 * @Span({ name: 'users.find', attributes: { 'db.table': 'users' } })
 * async findOne(id: string) {
 *   return this.db.select()...
 * }
 * ```
 */
export const Span = (options?: SpanOptions) => SetMetadata(SPAN_METADATA_KEY, options || {});
