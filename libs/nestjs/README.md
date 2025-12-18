# @code-hive/nestjs

Shared NestJS utilities and modules for the Code Hive monorepo.

## Usage

Import from specific subpaths for better tree-shaking:

```typescript
// Import specific modules
import { BullBoardModule } from '@code-hive/nestjs/bullboard';
import { ConfigModule } from '@code-hive/nestjs/config';
import { SwaggerModule } from '@code-hive/nestjs/swagger';
import { BaseError } from '@code-hive/nestjs/errors';
import { MyDecorator } from '@code-hive/nestjs/decorators';
import { MyGuard } from '@code-hive/nestjs/guards';
import { MyInterceptor } from '@code-hive/nestjs/interceptors';
import { MyFilter } from '@code-hive/nestjs/filters';
import { MyPipe } from '@code-hive/nestjs/pipes';
import { myUtil } from '@code-hive/nestjs/utils';

// Or import everything from the main entry (less optimal for tree-shaking)
import { BullBoardModule, ConfigModule, SwaggerModule } from '@code-hive/nestjs';
```

## Structure

- `src/bullboard/` - BullBoard module for queue monitoring
- `src/config/` - Configuration module
- `src/swagger/` - Swagger module for API documentation
- `src/errors/` - Custom error classes for structured error handling
- `src/logger/` - Logger module with Pino integration
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
    path: 'queues',
    redisUrl: process.env.REDIS_URL,
    queues: [{ name: 'email-queue' }, { name: 'source-queue' }, { name: 'media-queue' }],
  });

  await app.listen(3000);
}
bootstrap();
```

The BullBoard UI will be available at `http://localhost:3000/queues`.

## Swagger Module

The Swagger module provides API documentation using Swagger/OpenAPI.

### Usage

1. Import the module in your app module:

```typescript
import { Module } from '@nestjs/common';
import { SwaggerModule } from '@code-hive/nestjs/swagger';

@Module({
  imports: [
    SwaggerModule.forRoot({
      title: 'My API Documentation',
      description: 'API documentation for my service',
      version: '1.0',
      path: 'api/docs', // Optional, defaults to 'api/docs'
      auth: {
        bearer: {
          name: 'access-token',
          description: 'Access token',
        },
        cookie: {
          name: 'refresh-token',
          description: 'Refresh token',
        },
      },
    }),
  ],
})
export class AppModule {}
```

2. Setup Swagger in your `main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { SwaggerModule } from '@code-hive/nestjs/swagger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Setup Swagger after app initialization
  SwaggerModule.setup(app, {
    title: 'My API Documentation',
    description: 'API documentation for my service',
    version: '1.0',
    path: 'api/docs',
    auth: {
      bearer: {
        name: 'access-token',
        description: 'Access token',
      },
      cookie: {
        name: 'refresh-token',
        description: 'Refresh token',
      },
    },
  });

  await app.listen(3000);
}
bootstrap();
```

The Swagger UI will be available at `http://localhost:3000/api/docs`.

### Configuration Options

- `path` - Base path for Swagger UI (default: `'api/docs'`)
- `title` - API title (required)
- `description` - API description (optional, defaults to title)
- `version` - API version (default: `'1.0'`)
- `auth` - Authentication configuration:
  - `bearer` - Bearer token authentication
  - `cookie` - Cookie authentication
- `swaggerOptions` - Additional Swagger setup options (explorer, jsonDocumentUrl, etc.)

## Errors Module

The Errors module provides a comprehensive set of custom error classes for structured error handling across your application. All errors integrate seamlessly with the Logger module for automatic error logging.

### Features

- ✅ **Base error class** - Common error properties and methods
- ✅ **Transport recognition** - Automatically detected as HTTP vs RPC vs WS via Nest context
- ✅ **Automatic logging integration** - Works seamlessly with `ExceptionLoggingFilter`
- ✅ **Client-safe error responses** - Control what gets exposed to clients
- ✅ **Metadata support** - Attach additional context to errors
- ✅ **Type-safe error codes** - Programmatic error identification

### Base Error Class

All custom errors extend `BaseError`, which provides:

- `code` - Programmatic error identifier
- `transport` - `'http' | 'rpc' | 'ws' | 'unknown'`
- `statusCode` - HTTP status code (optional)
- `metadata` - Additional context data
- `timestamp` - When the error was created
- `loggable` - Whether to log the error
- `exposeToClient` - Whether to expose details to clients
- `toJSON()` - Serialize error for logging
- `getClientSafeError()` - Get safe error response for clients

### Creating Errors

Use `BaseError` for all cases. Set `transport` when you want to explicitly tag the intended mapping (HTTP vs RPC vs WS), and set `statusCode` when you want a specific HTTP status.

```typescript
import { BaseError } from '@code-hive/nestjs/errors';

// HTTP-shaped error
throw new BaseError('Resource not found', 'RESOURCE_NOT_FOUND', {
  statusCode: 404,
  metadata: { resourceId: '123', resourceType: 'user' },
});

// RPC-shaped error (no statusCode)
throw new BaseError('Service unavailable', 'SERVICE_UNAVAILABLE', {
  metadata: { serviceName: 'payment-service' },
});
```

### Usage Examples

#### Basic Usage

```typescript
import { BaseError } from '@code-hive/nestjs/errors';

@Injectable()
export class UsersService {
  async findUser(id: string) {
    if (!id) {
      throw new BaseError('User ID is required', 'USER_ID_REQUIRED', { statusCode: 400 });
    }

    const user = await this.repository.findOne(id);
    if (!user) {
      throw new BaseError('User not found', 'USER_NOT_FOUND', {
        statusCode: 404,
        metadata: { userId: id },
      });
    }

    return user;
  }
}
```

#### With Metadata

```typescript
import { BaseError } from '@code-hive/nestjs/errors';

async validateEmail(email: string) {
  if (!email.includes('@')) {
    throw new BaseError('Invalid email format', 'INVALID_EMAIL_FORMAT', {
      statusCode: 400,
      metadata: {
        value: email,
        reason: 'missing @ symbol',
      },
    });
  }
}
```

#### Controlling Logging and Exposure

```typescript
import { BaseError } from '@code-hive/nestjs/errors';

// Don't log expected business errors
throw new BaseError('Item out of stock', 'OUT_OF_STOCK', {
  loggable: false,
  exposeToClient: true,
});

// Don't expose internal details to clients
throw new BaseError('Database connection failed', 'DB_ERROR', {
  loggable: true,
  exposeToClient: false,
  metadata: { connectionString: 'internal-db-url' }, // Only in logs
});
```

### Integration with Logger Module

The errors module integrates automatically with the `ExceptionLoggingFilter` from the Logger module:

1. **Automatic detection** - Custom errors are automatically detected and handled
2. **Structured logging** - Uses `toJSON()` method for consistent log format
3. **Client responses** - Uses `getClientSafeError()` for safe error responses
4. **Respects flags** - Honors `loggable` and `exposeToClient` flags
5. **Status codes** - Uses custom error status codes when available

### Error Response Format

When using custom errors with the `ExceptionLoggingFilter`, HTTP responses follow this format:

```json
{
  "statusCode": 404,
  "code": "RESOURCE_NOT_FOUND",
  "message": "Resource not found",
  "metadata": {
    "resourceId": "123",
    "resourceType": "user"
  }
}
```

### Best Practices

1. **Rely on automatic transport detection** - `BaseError.transport` is set by `ExceptionLoggingFilter`
2. **Include error codes** - Always provide meaningful error codes for programmatic handling
3. **Add metadata** - Include relevant context in the metadata field
4. **Control exposure** - Use `exposeToClient: false` for internal errors
5. **Control logging** - Set `loggable: false` for expected business errors
6. **Put validation details in metadata** - e.g. `metadata: { field: 'email', value }`

## Development

```bash
# Build
pnpm build

# Lint
pnpm lint
```
