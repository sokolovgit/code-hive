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
  // Merge default config with provided config options
  const dotenvConfig = {
    debug: process.env.NODE_ENV !== Environments.PRODUCTION,
    quiet: process.env.NODE_ENV === Environments.PRODUCTION,
    ...options.config,
  };

  const dotenvResult = config(dotenvConfig);
  const result = expand({
    ...dotenvResult,
    ...options.expand,
  });

  if (!options.silent) {
    if (result?.error) {
      console.error(`[loadEnv] Error: ${result.error.message}`);
    } else if (result?.parsed) {
      console.log(`[loadEnv] Loaded ${Object.keys(result.parsed).length} environment variables`);
    } else {
      console.warn('[loadEnv] No environment variables were loaded');
    }
  }

  return result;
};
