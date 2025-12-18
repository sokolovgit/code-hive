import { Environments } from '@code-hive/nestjs/enums';
import { LoggerModule } from '@code-hive/nestjs/logger';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    LoggerModule.forRoot({
      environment: (process.env.NODE_ENV as Environments) || Environments.DEVELOPMENT,
      appName: 'users-service',
      level: process.env.LOG_LEVEL || 'info',
      prettyPrint: process.env.NODE_ENV !== 'production',
    }),
  ],
  controllers: [],
  providers: [],
})
export class AppModule {}
