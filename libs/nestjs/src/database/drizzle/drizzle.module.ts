import {
  DynamicModule,
  Global,
  Module,
  OnModuleDestroy,
  Provider,
  Type,
  Inject,
  Optional,
} from '@nestjs/common';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool, PoolConfig } from 'pg';

import { LoggerService } from '../../logger';

import { DRIZZLE_DB, DRIZZLE_OPTIONS, DRIZZLE_POOL } from './drizzle.constants';
import { DrizzleDatabase, DrizzleModuleOptions } from './drizzle.types';

import type { ModuleMetadata } from '@nestjs/common/interfaces';

export interface DrizzleModuleAsyncOptions<TFactoryArgs extends unknown[] = unknown[]> extends Pick<
  ModuleMetadata,
  'imports'
> {
  inject?: { [K in keyof TFactoryArgs]: Type<TFactoryArgs[K]> | string | symbol };
  useFactory: (...args: TFactoryArgs) => DrizzleModuleOptions | Promise<DrizzleModuleOptions>;
}

@Global()
@Module({})
export class DrizzleModule implements OnModuleDestroy {
  static forRoot(options: DrizzleModuleOptions): DynamicModule {
    const providers = this.createProviders(options);

    return {
      module: DrizzleModule,
      providers,
      exports: [DRIZZLE_DB, DRIZZLE_POOL],
    };
  }

  static forRootAsync<TFactoryArgs extends unknown[] = unknown[]>(
    options: DrizzleModuleAsyncOptions<TFactoryArgs>
  ): DynamicModule {
    const optionsProvider: Provider = {
      provide: DRIZZLE_OPTIONS,
      useFactory: options.useFactory,
      inject: (options.inject ?? []) as Array<Type<unknown> | string | symbol>,
    };

    const poolProvider: Provider = {
      provide: DRIZZLE_POOL,
      useFactory: (opts: DrizzleModuleOptions, logger?: LoggerService) => {
        return this.createPool(opts, logger);
      },
      inject: [DRIZZLE_OPTIONS, LoggerService],
    };

    const dbProvider: Provider = {
      provide: DRIZZLE_DB,
      useFactory: (
        pool: Pool,
        opts: DrizzleModuleOptions,
        logger?: LoggerService
      ): DrizzleDatabase => {
        return this.createDrizzleInstance(pool, opts, logger);
      },
      inject: [DRIZZLE_POOL, DRIZZLE_OPTIONS, LoggerService],
    };

    return {
      module: DrizzleModule,
      imports: options.imports ?? [],
      providers: [optionsProvider, poolProvider, dbProvider],
      exports: [DRIZZLE_DB, DRIZZLE_POOL],
    };
  }

  private static createProviders(options: DrizzleModuleOptions): Provider[] {
    const poolProvider: Provider = {
      provide: DRIZZLE_POOL,
      useFactory: (logger?: LoggerService) => {
        return this.createPool(options, logger);
      },
      inject: [LoggerService],
    };

    const dbProvider: Provider = {
      provide: DRIZZLE_DB,
      useFactory: (pool: Pool, logger?: LoggerService): DrizzleDatabase => {
        return this.createDrizzleInstance(pool, options, logger);
      },
      inject: [DRIZZLE_POOL, LoggerService],
    };

    return [poolProvider, dbProvider];
  }

  private static createPool(options: DrizzleModuleOptions, logger?: LoggerService): Pool {
    const poolConfig: PoolConfig =
      typeof options.connection === 'string'
        ? {
            connectionString: options.connection,
            ...options.pool,
          }
        : {
            ...options.connection,
            ...options.pool,
          };

    const pool = new Pool(poolConfig);

    // Connection event handlers
    pool.on('connect', () => {
      logger?.debug('New database connection established');
    });

    pool.on('error', (err) => {
      logger?.error({ err }, 'Unexpected database pool error');
    });

    pool.on('acquire', () => {
      logger?.debug('Connection acquired from pool');
    });

    pool.on('release', () => {
      logger?.debug('Connection released to pool');
    });

    return pool;
  }

  private static createDrizzleInstance(
    pool: Pool,
    options: DrizzleModuleOptions,
    logger?: LoggerService
  ): DrizzleDatabase {
    const drizzleOptions: Parameters<typeof drizzle>[1] = {};

    if (options.schema) {
      drizzleOptions.schema = options.schema as Record<string, unknown>;
    }

    // Add logger if query logging is enabled
    if (options.logQueries && logger) {
      drizzleOptions.logger = {
        logQuery: (query: string, params: unknown[]) => {
          logger.debug(
            {
              query,
              params,
            },
            'Database query executed'
          );
        },
      };
    }

    return drizzle(pool, drizzleOptions) as unknown as DrizzleDatabase;
  }

  constructor(
    @Inject(DRIZZLE_POOL) private readonly pool: Pool,
    @Optional() private readonly logger?: LoggerService
  ) {}

  async onModuleDestroy() {
    if (this.pool) {
      await this.pool.end();
      this.logger?.info('Database connection pool closed');
    }
  }
}
