import { loadEnv } from '@code-hive/nestjs/config';
loadEnv();
// eslint-disable-next-line import/order
import { initOpenTelemetry } from '@code-hive/nestjs/telemetry';
initOpenTelemetry();

import { LoggerService } from '@code-hive/nestjs/logger';
import { SwaggerModule } from '@code-hive/nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule, {
    bufferLogs: true,
  });

  const logger = app.get(LoggerService);
  app.useLogger(logger);

  const config = app.get(ConfigService);

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

  app.setGlobalPrefix(config.globalPrefix);

  const isDocsEnabled = config.docs.enabled;
  if (isDocsEnabled) {
    await SwaggerModule.setup(app, config.getSwaggerOptions());
  }

  const { port, host } = config.server;
  await app.listen(port, host);

  const appUrl = await app.getUrl();
  logger.info(`Application is running on ${appUrl}`);

  if (isDocsEnabled) {
    logger.info(`Swagger documentation available at ${appUrl}/${config.docs.path}`);
  }
}

bootstrap();
