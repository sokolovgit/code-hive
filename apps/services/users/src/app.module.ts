import { ClsModuleWrapper } from '@code-hive/nestjs/cls';
import { ConfigModule } from '@code-hive/nestjs/config';
import { DrizzleModule } from '@code-hive/nestjs/database/drizzle';
import {
  ExceptionLoggingFilter,
  HttpLoggingInterceptor,
  LoggerModule,
  LoggerService,
} from '@code-hive/nestjs/logger';
import { SwaggerModule } from '@code-hive/nestjs/swagger';
import { Module } from '@nestjs/common';
import { APP_FILTER, APP_INTERCEPTOR } from '@nestjs/core';
import { ClsService } from 'nestjs-cls';

import { ConfigService } from './config/config.service';
import { validationSchema } from './config/env.schema';
import { PingController } from './ping.controller';
import { UsersModule } from './users/users.module';
import * as schema from './users/users.schema';

@Module({
  controllers: [PingController],
  imports: [
    // Set up CLS first with Drizzle transactional plugin
    ClsModuleWrapper.forRoot({
      plugins: [DrizzleModule.getTransactionalPlugin()],
    }),
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
    DrizzleModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        ...config.getDrizzleOptions(),
        schema,
      }),
    }),
    UsersModule,
  ],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      inject: [LoggerService, ConfigService, ClsService],
      useFactory: (logger: LoggerService, config: ConfigService, cls: ClsService) =>
        new HttpLoggingInterceptor(logger, cls, config.getHttpLoggingInterceptorOptions()),
    },
    {
      provide: APP_FILTER,
      inject: [LoggerService, ClsService],
      useFactory: (logger: LoggerService, cls: ClsService) =>
        new ExceptionLoggingFilter(logger, cls),
    },
  ],
})
export class AppModule {}
