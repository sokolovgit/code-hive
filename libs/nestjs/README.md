# @code-hive/nestjs

Shared NestJS utilities and modules for the Code Hive monorepo.

## Usage

Import from specific subpaths for better tree-shaking:

```typescript
// Import specific modules
import { BullBoardModule } from '@code-hive/nestjs/bullboard';
import { ConfigModule } from '@code-hive/nestjs/config';
import { SwaggerModule } from '@code-hive/nestjs/swagger';
import { BaseError, BusinessError, HttpError } from '@code-hive/nestjs/errors';
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
- ✅ **Specialized error types** - HTTP, RPC, Business, Data, Auth, and External errors
- ✅ **Automatic logging integration** - Works seamlessly with `ExceptionLoggingFilter`
- ✅ **Client-safe error responses** - Control what gets exposed to clients
- ✅ **Metadata support** - Attach additional context to errors
- ✅ **Type-safe error codes** - Programmatic error identification

### Base Error Class

All custom errors extend `BaseError`, which provides:

- `code` - Programmatic error identifier
- `statusCode` - HTTP status code (optional)
- `metadata` - Additional context data
- `timestamp` - When the error was created
- `loggable` - Whether to log the error
- `exposeToClient` - Whether to expose details to clients
- `toJSON()` - Serialize error for logging
- `getClientSafeError()` - Get safe error response for clients

### Error Types

#### HttpError

For HTTP-specific errors with status codes.

```typescript
import { HttpError } from '@code-hive/nestjs/errors';

throw new HttpError('Resource not found', 404, {
  code: 'RESOURCE_NOT_FOUND',
  metadata: { resourceId: '123', resourceType: 'user' },
});
```

#### RpcError

For microservices RPC communication errors.

```typescript
import { RpcError } from '@code-hive/nestjs/errors';

throw new RpcError('Service unavailable', 'SERVICE_UNAVAILABLE', {
  rpcCode: 'UNAVAILABLE',
  metadata: { serviceName: 'payment-service' },
});
```

#### BusinessError

For business logic violations (default: 400 status, less logging).

```typescript
import { BusinessError } from '@code-hive/nestjs/errors';

throw new BusinessError('Insufficient funds', 'INSUFFICIENT_FUNDS', {
  metadata: { accountId: '123', balance: 50, required: 100 },
});
```

#### DataError

For data validation and integrity errors (includes `field` property).

```typescript
import { DataError } from '@code-hive/nestjs/errors';

throw new DataError('Invalid email format', 'INVALID_EMAIL', {
  field: 'email',
  metadata: { value: 'invalid-email' },
});
```

#### AuthError

For authentication and authorization errors (default: 401 status, logged for security).

```typescript
import { AuthError } from '@code-hive/nestjs/errors';

throw new AuthError('Invalid token', 'INVALID_TOKEN', {
  metadata: { tokenType: 'bearer' },
});
```

#### ExternalError

For third-party service errors (default: 502 status, not exposed to clients).

```typescript
import { ExternalError } from '@code-hive/nestjs/errors';

throw new ExternalError('Payment gateway error', 'PAYMENT_GATEWAY_ERROR', {
  serviceName: 'stripe',
  originalError: gatewayError,
  metadata: { transactionId: 'txn_123' },
});
```

### Usage Examples

#### Basic Usage

```typescript
import { BusinessError, HttpError } from '@code-hive/nestjs/errors';

@Injectable()
export class UsersService {
  async findUser(id: string) {
    if (!id) {
      throw new BusinessError('User ID is required', 'USER_ID_REQUIRED');
    }

    const user = await this.repository.findOne(id);
    if (!user) {
      throw new HttpError('User not found', 404, {
        code: 'USER_NOT_FOUND',
        metadata: { userId: id },
      });
    }

    return user;
  }
}
```

#### With Metadata

```typescript
import { DataError } from '@code-hive/nestjs/errors';

async validateEmail(email: string) {
  if (!email.includes('@')) {
    throw new DataError('Invalid email format', 'INVALID_EMAIL_FORMAT', {
      field: 'email',
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
import { BusinessError } from '@code-hive/nestjs/errors';

// Don't log expected business errors
throw new BusinessError('Item out of stock', 'OUT_OF_STOCK', {
  loggable: false,
  exposeToClient: true,
});

// Don't expose internal details to clients
throw new BusinessError('Database connection failed', 'DB_ERROR', {
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

1. **Use appropriate error types** - Choose the right error class for your use case
2. **Include error codes** - Always provide meaningful error codes for programmatic handling
3. **Add metadata** - Include relevant context in the metadata field
4. **Control exposure** - Use `exposeToClient: false` for internal errors
5. **Control logging** - Set `loggable: false` for expected business errors
6. **Use field property** - For validation errors, use `DataError` with the `field` property

## Development

```bash
# Build
pnpm build

# Lint
pnpm lint
```
