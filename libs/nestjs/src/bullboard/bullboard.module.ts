import { DynamicModule, Module } from '@nestjs/common';
import { INestApplication } from '@nestjs/common';
import { Queue } from 'bullmq';
import { createBullBoard } from '@bull-board/api';
import { BullMQAdapter } from '@bull-board/api/bullMQAdapter';
import { ExpressAdapter } from '@bull-board/express';

export interface BullBoardQueueConfig {
  name: string;
  connection?: {
    host?: string;
    port?: number;
    password?: string;
    db?: number;
    url?: string;
  };
}

export interface BullBoardModuleOptions {
  /**
   * Base path for the BullBoard UI (e.g., 'admin/queues')
   * @default 'admin/queues'
   */
  path?: string;
  /**
   * Redis connection URL
   */
  redisUrl: string;
  /**
   * Queue configurations to display in BullBoard
   */
  queues: BullBoardQueueConfig[];
}

@Module({})
export class BullBoardModule {
  static forRoot(options: BullBoardModuleOptions): DynamicModule {
    return {
      module: BullBoardModule,
      providers: [
        {
          provide: 'BULL_BOARD_OPTIONS',
          useValue: options,
        },
      ],
      exports: ['BULL_BOARD_OPTIONS'],
    };
  }

  /**
   * Setup BullBoard for the given NestJS application
   * This should be called in your main.ts after app initialization
   */
  static setup(app: INestApplication, options: BullBoardModuleOptions): void {
    const bullBoardPath = options.path || 'admin/queues';
    const serverAdapter = new ExpressAdapter();

    serverAdapter.setBasePath(`/${bullBoardPath}`);

    const bullMQAdapters = options.queues.map((queueConfig) => {
      const connection = queueConfig.connection || {};

      return new BullMQAdapter(
        new Queue(queueConfig.name, {
          connection: {
            ...connection,
            ...(options.redisUrl && !connection.url ? { url: options.redisUrl } : {}),
          },
        })
      );
    });

    createBullBoard({
      queues: bullMQAdapters,
      serverAdapter,
    });

    app.use(`/${bullBoardPath}`, serverAdapter.getRouter());
  }
}
