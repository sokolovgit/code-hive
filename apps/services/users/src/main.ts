import { loadEnv } from '@code-hive/nestjs/config';
loadEnv();
import { SwaggerModule } from '@code-hive/nestjs/swagger';
import { ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';

import { AppModule } from './app.module';
import { ConfigService } from './config/config.service';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
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

  // API prefix
  // const globalPrefix = 'api/v1';
  // app.setGlobalPrefix(globalPrefix);

  const isDocsEnabled = config.docs.enabled;
  if (isDocsEnabled) {
    SwaggerModule.setup(app, config.getSwaggerOptions());
  }

  const { port, host } = config.server;
  await app.listen(port, host);
}

bootstrap();
