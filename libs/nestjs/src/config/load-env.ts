import { config, DotenvConfigOptions } from 'dotenv';
import { expand, DotenvExpandOptions } from 'dotenv-expand';

import { Environments } from '../enums';

export type LoadEnvOptions = Partial<{
  config: DotenvConfigOptions;
  expand: DotenvExpandOptions;
  silent?: boolean;
}>;

export const loadEnv = (
  options: LoadEnvOptions = {
    config: {
      debug: process.env.NODE_ENV !== Environments.PRODUCTION,
      quiet: process.env.NODE_ENV === Environments.PRODUCTION,
    },
    silent: false,
  }
) => {
  const result = expand({
    ...config(options.config),
    ...options.expand,
  });

  if (!options.silent) {
    console.log('Environment variables loaded successfully');
  }

  return result;
};
