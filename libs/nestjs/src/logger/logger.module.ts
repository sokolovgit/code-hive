import { DynamicModule, Global, Module, Provider, Type } from '@nestjs/common';
import type { ModuleMetadata } from '@nestjs/common/interfaces';

import { LOGGER_OPTIONS } from './logger.constants';
import { LoggerService, LoggerModuleOptions } from './logger.service';

export interface LoggerModuleAsyncOptions<TFactoryArgs extends unknown[] = unknown[]> extends Pick<
  ModuleMetadata,
  'imports'
> {
  /**
   * Dependencies to inject into `useFactory` (e.g. `ConfigService`)
   */
  inject?: { [K in keyof TFactoryArgs]: Type<TFactoryArgs[K]> | string | symbol };
  /**
   * Factory returning the `LoggerModuleOptions` (sync or async)
   */
  useFactory: (...args: TFactoryArgs) => LoggerModuleOptions | Promise<LoggerModuleOptions>;
}

@Global()
@Module({})
export class LoggerModule {
  static forRoot(options: LoggerModuleOptions = {}): DynamicModule {
    const loggerOptionsProvider: Provider = {
      provide: LOGGER_OPTIONS,
      useValue: options,
    };

    const loggerServiceProvider: Provider = {
      provide: LoggerService,
      useFactory: (options: LoggerModuleOptions) => {
        return new LoggerService(options);
      },
      inject: [LOGGER_OPTIONS],
    };

    return {
      module: LoggerModule,
      providers: [loggerOptionsProvider, loggerServiceProvider],
      exports: [LoggerService],
    };
  }

  static forRootAsync<TFactoryArgs extends unknown[] = unknown[]>(
    options: LoggerModuleAsyncOptions<TFactoryArgs>
  ): DynamicModule {
    const loggerOptionsProvider: Provider = {
      provide: LOGGER_OPTIONS,
      useFactory: options.useFactory,
      inject: (options.inject ?? []) as Array<Type<unknown> | string | symbol>,
    };

    const loggerServiceProvider: Provider = {
      provide: LoggerService,
      useFactory: (loggerOptions: LoggerModuleOptions) => new LoggerService(loggerOptions),
      inject: [LOGGER_OPTIONS],
    };

    return {
      module: LoggerModule,
      imports: options.imports ?? [],
      providers: [loggerOptionsProvider, loggerServiceProvider],
      exports: [LoggerService],
    };
  }
}
