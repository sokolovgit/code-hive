import { NodePgDatabase } from 'drizzle-orm/node-postgres';
import { PoolConfig } from 'pg';

export interface DrizzleModuleOptions<
  TSchema extends Record<string, unknown> = Record<string, unknown>,
> {
  /**
   * PostgreSQL connection string or Pool configuration
   */
  connection: string | PoolConfig;

  /**
   * Custom schema for type-safe queries
   */
  schema?: TSchema;

  /**
   * Enable query logging (uses LoggerService if available)
   */
  logQueries?: boolean;

  /**
   * Connection pool configuration
   */
  pool?: {
    min?: number;
    max?: number;
    idleTimeoutMillis?: number;
    connectionTimeoutMillis?: number;
  };

  /**
   * Enable connection health checks
   */
  healthCheck?: boolean;

  /**
   * Retry configuration for connection failures
   */
  retry?: {
    maxRetries?: number;
    retryDelay?: number;
  };
}

export type DrizzleDatabase<TSchema extends Record<string, unknown> = Record<string, unknown>> =
  NodePgDatabase<TSchema>;
