# @code-hive/nestjs

Shared NestJS utilities and modules for the Code Hive monorepo.

## Usage

Import from specific subpaths for better tree-shaking:

```typescript
// Import specific modules
import { MyDecorator } from '@code-hive/nestjs/decorators';
import { MyGuard } from '@code-hive/nestjs/guards';
import { MyInterceptor } from '@code-hive/nestjs/interceptors';
import { MyFilter } from '@code-hive/nestjs/filters';
import { MyPipe } from '@code-hive/nestjs/pipes';
import { myUtil } from '@code-hive/nestjs/utils';

// Or import everything from the main entry (less optimal for tree-shaking)
import { MyDecorator, MyGuard } from '@code-hive/nestjs';
```

## Structure

- `src/decorators/` - Shared decorators
- `src/guards/` - Shared guards
- `src/interceptors/` - Shared interceptors
- `src/filters/` - Shared exception filters
- `src/pipes/` - Shared pipes
- `src/utils/` - Shared utility functions
- `src/index.ts` - Main entry point that re-exports all modules

## Development

```bash
# Build
pnpm build

# Lint
pnpm lint
```
