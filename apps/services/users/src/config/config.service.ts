import { BaseConfigService } from '@code-hive/nestjs/config';
import { Environments } from '@code-hive/nestjs/enums';
import { Injectable } from '@nestjs/common';

import { EnvType } from './env.schema';

@Injectable()
export class ConfigService extends BaseConfigService<EnvType> {
  server = {
    port: this.env.PORT,
    host: this.env.HOST,
    env: this.env.NODE_ENV,
  };

  docs = {
    enabled: this.env.DOCS_ENABLED,
    path: this.env.DOCS_PATH,
  };

  isProduction(): boolean {
    return this.server.env === Environments.PRODUCTION;
  }

  isDevelopment(): boolean {
    return this.server.env === Environments.DEVELOPMENT;
  }

  getAppName(): string {
    return `${this.env.npm_package_name}:${this.env.npm_package_version}`;
  }
}
