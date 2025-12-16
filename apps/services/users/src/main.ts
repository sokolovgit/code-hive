import { Logger, ValidationPipe } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app/app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

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

  Logger.log(`🚀 Users service is running on: http://localhost:${port}/${globalPrefix}`);
  Logger.log(`📝 Environment: ${process.env.NODE_ENV || 'development'}`);
}

bootstrap();
