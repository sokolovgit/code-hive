import { loadEnv } from '@code-hive/nestjs/config';
import { initOpenTelemetry } from '@code-hive/nestjs/telemetry';

export const initTelemetry = () => {
  loadEnv();
  initOpenTelemetry();
};
