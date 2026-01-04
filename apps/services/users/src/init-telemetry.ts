import { loadEnv } from '@code-hive/nestjs/config';
import { Environments } from '@code-hive/nestjs/enums';
import { setupOpenTelemetry } from '@code-hive/nestjs/telemetry';

loadEnv({
  config: {
    debug: process.env.NODE_ENV !== Environments.PRODUCTION,
  },
  silent: process.env.NODE_ENV === Environments.PRODUCTION,
});

setupOpenTelemetry();
