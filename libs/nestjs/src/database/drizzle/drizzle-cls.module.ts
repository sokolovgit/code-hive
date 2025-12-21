import { DynamicModule, Module } from '@nestjs/common';
import { ClsPluginTransactional } from '@nestjs-cls/transactional';
import { TransactionalAdapterDrizzleOrm } from '@nestjs-cls/transactional-adapter-drizzle-orm';

import { ClsModule } from '../../cls';

import { DRIZZLE_DB } from './drizzle.constants';

export interface DrizzleClsModuleOptions {
  /**
   * Token used for Drizzle instance (must match DrizzleModule export)
   * @default DRIZZLE_DB
   */
  drizzleToken?: string | symbol;
}

/**
 * Drizzle CLS Module - Extends ClsModule with transactional support
 *
 * This module sets up CLS with the transactional plugin for Drizzle ORM.
 * It internally uses ClsModule to set up the base CLS infrastructure.
 */
@Module({})
export class DrizzleClsModule {
  static forRoot(options: DrizzleClsModuleOptions = {}): DynamicModule {
    const { drizzleToken = DRIZZLE_DB } = options;

    return {
      module: DrizzleClsModule,
      imports: [
        // Set up CLS with transactional plugin
        ClsModule.forRoot({
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
    };
  }
}
