import { ConfigModule } from '@code-hive/nestjs/config';
import {
  ExceptionLoggingFilter,
  HttpLoggingInterceptor,
  LoggerModule,
  LoggerService,
} from '@code-hive/nestjs/logger';
import { SwaggerModule } from '@code-hive/nestjs/swagger';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';

import { ConfigService } from './config/config.service';
import { validationSchema } from './config/env.schema';
import { PingController } from './ping.controller';

@Module({
  imports: [
    ConfigModule.forRoot({
      validationSchema,
      providers: [ConfigService],
    }),
    LoggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.getLoggerOptions(),
    }),
    SwaggerModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => config.getSwaggerOptions(),
    }),
  ],
  controllers: [PingController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useFactory: (logger: LoggerService, config: ConfigService) =>
        new HttpLoggingInterceptor(logger, config.getHttpLoggingInterceptorOptions()),
      inject: [LoggerService, ConfigService],
    },
    {
      provide: APP_FILTER,
      useFactory: (logger: LoggerService) => new ExceptionLoggingFilter(logger),
      inject: [LoggerService],
    },
  ],
})
export class AppModule {}
