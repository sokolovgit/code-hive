import { join } from 'path';

import { loadEnv } from '@code-hive/nestjs/config';
import { initOpenTelemetry } from '@code-hive/nestjs/telemetry';

const root = join(__dirname, '../../../');

export const initTelemetry = () => {
  const result = loadEnv({ config: { path: [join(root, '.env'), '.env'] } });
  console.log(result);
  initOpenTelemetry();
};
