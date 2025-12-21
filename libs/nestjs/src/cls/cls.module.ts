import { DynamicModule, Global, Module } from '@nestjs/common';
import {
  ClsModule as NestClsModule,
  ClsModuleOptions as NestClsModuleOptions,
  ClsPlugin,
} from 'nestjs-cls';

import type { Request } from 'express';
import type { ClsService } from 'nestjs-cls';

export interface ClsModuleOptions extends Partial<NestClsModuleOptions> {
  /**
   * Enable CLS middleware
   * @default true
   */
  enableMiddleware?: boolean;

  /**
   * Custom setup function for CLS context
   */
  setup?: (cls: ClsService, req: Request) => void;

  /**
   * Additional CLS plugins to register
   */
  plugins?: ClsPlugin[];
}

@Global()
@Module({})
export class ClsModule {
  static forRoot(options: ClsModuleOptions = {}): DynamicModule {
    const { enableMiddleware = true, setup, plugins = [], ...clsOptions } = options;

    return {
      module: ClsModule,
      imports: [
        NestClsModule.forRoot({
          global: true,
          middleware: {
            mount: enableMiddleware,
            setup:
              setup ||
              (((cls: ClsService, req: Request) => {
                // Default setup: extract request ID from headers
                const requestId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
                if (requestId) {
                  cls.set('requestId', Array.isArray(requestId) ? requestId[0] : requestId);
                }
              }) as (cls: ClsService, req: Request, res: unknown) => void),
          },
          plugins,
          ...clsOptions,
        }),
      ],
      exports: [NestClsModule],
    };
  }
}
