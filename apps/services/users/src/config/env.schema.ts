import { Environments } from '@code-hive/nestjs/enums';
import { z } from 'zod';

export const validationSchema = z.object({
  NODE_ENV: z.enum(Object.values(Environments)),

  npm_package_name: z.string(),
  npm_package_version: z.string(),

  PORT: z.coerce.number().default(3000),
  HOST: z.string().default('0.0.0.0'),

  DOCS_ENABLED: z
    .string()
    .transform((val) => val === 'true')
    .or(z.boolean())
    .default(true),
  DOCS_PATH: z.string().default('api/docs'),

  DATABASE_URL: z.url(),
});

export type EnvType = z.infer<typeof validationSchema>;
