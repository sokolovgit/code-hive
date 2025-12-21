import { SetMetadata } from '@nestjs/common';

export const TRACE_METADATA_KEY = 'telemetry:trace';

export interface TraceOptions {
  /**
   * Span name (defaults to method name)
   */
  name?: string;

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
}

/**
 * @Trace() decorator - Automatically creates a span for the method
 *
 * @example
 * ```typescript
 * @Trace({ name: 'users.find', attributes: { 'db.table': 'users' } })
 * async findOne(id: string) {
 *   return this.db.select()...
 * }
 * ```
 */
export const Trace = (options?: TraceOptions) => SetMetadata(TRACE_METADATA_KEY, options || {});
