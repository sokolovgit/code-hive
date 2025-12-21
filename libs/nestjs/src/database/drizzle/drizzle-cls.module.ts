import { DynamicModule, Module } from '@nestjs/common';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';
import { ClsModule } from 'nestjs-cls';

import { DRIZZLE_DB } from './drizzle.constants';

export interface DrizzleClsModuleOptions {
  /**
   * Token used for Drizzle instance (must match DrizzleModule export)
   * @default DRIZZLE_DB
   */
  drizzleToken?: string | symbol;
}

@Module({})
export class DrizzleClsModule {
  static forRoot(options: DrizzleClsModuleOptions = {}): DynamicModule {
    const { drizzleToken = DRIZZLE_DB } = options;

    return {
      module: DrizzleClsModule,
      imports: [
        ClsModule.forRoot({
          global: true,
          middleware: {
            mount: true,
            setup: (cls, req) => {
              // Set request context from headers
              const requestId = req.headers['x-request-id'] || req.headers['x-correlation-id'];
              if (requestId) {
                cls.set('requestId', Array.isArray(requestId) ? requestId[0] : requestId);
              }
            },
          },
          plugins: [
            new ClsPluginTransactional({
              imports: [], // DrizzleModule should be imported separately
              adapter: new TransactionalAdapterDrizzleOrm({
                drizzleInstanceToken: drizzleToken,
              }),
            }),
          ],
        }),
      ],
      exports: [ClsModule],
    };
  }
}
