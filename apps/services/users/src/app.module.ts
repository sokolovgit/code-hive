import { ConfigModule } from '@code-hive/nestjs/config';
import {
  ExceptionLoggingFilter,
  HttpLoggingInterceptor,
  LoggerModule,
  LoggerService,
} from '@code-hive/nestjs/logger';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { ConfigService } from './config/config.service';
import { validationSchema } from './config/env.schema';

@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema,
      providers: [ConfigService],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        environment: config.server.env,
        appName: config.getAppName(),
      }),
    }),
  ],
  controllers: [],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useFactory: (logger: LoggerService) =>
        new HttpLoggingInterceptor(logger, {
          logRequestBody: true,
          logResponseBody: true,
          logQuery: true,
          logHeaders: true,
        }),
      inject: [LoggerService],
    },
    {
      provide: APP_FILTER,
      useFactory: (logger: LoggerService) => new ExceptionLoggingFilter(logger),
      inject: [LoggerService],
    },
  ],
})
export class AppModule {}
