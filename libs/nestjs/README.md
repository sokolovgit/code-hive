# @code-hive/nestjs

Shared NestJS utilities and modules for the Code Hive monorepo.

## Usage

Import from specific subpaths for better tree-shaking:

```typescript
// Import specific modules
import { BullBoardModule } from '@code-hive/nestjs/bullboard';
import { ConfigModule } from '@code-hive/nestjs/config';
import { MyDecorator } from '@code-hive/nestjs/decorators';
import { MyGuard } from '@code-hive/nestjs/guards';
import { MyInterceptor } from '@code-hive/nestjs/interceptors';
import { MyFilter } from '@code-hive/nestjs/filters';
import { MyPipe } from '@code-hive/nestjs/pipes';
import { myUtil } from '@code-hive/nestjs/utils';

// Or import everything from the main entry (less optimal for tree-shaking)
import { BullBoardModule, ConfigModule } from '@code-hive/nestjs';
```

## Structure

- `src/bullboard/` - BullBoard module for queue monitoring
- `src/config/` - Configuration module
- `src/decorators/` - Shared decorators
- `src/enums/` - Shared enums
- `src/guards/` - Shared guards
- `src/interceptors/` - Shared interceptors
- `src/filters/` - Shared exception filters
- `src/pipes/` - Shared pipes
- `src/utils/` - Shared utility functions
- `src/index.ts` - Main entry point that re-exports all modules

## BullBoard Module

The BullBoard module provides a UI for monitoring BullMQ queues.

### Usage

1. Import the module in your app module:

```typescript
import { Module } from '@nestjs/common';
import { BullBoardModule } from '@code-hive/nestjs/bullboard';

@Module({
  imports: [
    BullBoardModule.forRoot({
      path: 'admin/queues', // Optional, defaults to 'admin/queues'
      redisUrl: process.env.REDIS_URL,
      queues: [
        { name: 'email-queue' },
        { name: 'source-queue' },
        { name: 'media-queue' },
        // Or with custom connection:
        {
          name: 'custom-queue',
          connection: {
            host: 'localhost',
            port: 6379,
          },
        },
      ],
    }),
  ],
})
export class AppModule {}
```

2. Setup BullBoard in your `main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { BullBoardModule } from '@code-hive/nestjs/bullboard';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Setup BullBoard after app initialization
  BullBoardModule.setup(app, {
    path: 'admin/queues',
    redisUrl: process.env.REDIS_URL,
    queues: [{ name: 'email-queue' }, { name: 'source-queue' }, { name: 'media-queue' }],
  });

  await app.listen(3000);
}
bootstrap();
```

The BullBoard UI will be available at `http://localhost:3000/admin/queues`.

## Development

```bash
# Build
pnpm build

# Lint
pnpm lint
```
