import { DynamicModule, Global, Module, Provider } from '@nestjs/common';

import { LOGGER_OPTIONS } from './logger.constants';
import { LoggerService, LoggerModuleOptions } from './logger.service';

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
}
