import {
  LoggerService,
  HttpLoggingInterceptor,
  ExceptionLoggingFilter,
} from '@code-hive/nestjs/logger';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Get logger service instance
  const loggerService = app.get(LoggerService);

  // Global exception filter - handles all errors and logs them
  app.useGlobalFilters(new ExceptionLoggingFilter(loggerService));
  // HTTP logging interceptor - logs all HTTP requests/responses

  app.useGlobalInterceptors(
    new HttpLoggingInterceptor(loggerService, {
      logRequestBody: true,
      logResponseBody: false,
      logQuery: true,
      logHeaders: false,
      skipPaths: ['/health', '/metrics'],
    })
  );

  // Global validation pipe
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
      transformOptions: {
        enableImplicitConversion: true,
      },
    })
  );

  // CORS configuration
  app.enableCors({
    origin: process.env.CORS_ORIGIN || '*',
    credentials: true,
  });

  // API prefix
  const globalPrefix = 'api/v1';
  app.setGlobalPrefix(globalPrefix);

  const port = process.env.PORT || 3001;
  await app.listen(port);

  loggerService.log(`🚀 Users service is running on: http://localhost:${port}/${globalPrefix}`);
  loggerService.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
