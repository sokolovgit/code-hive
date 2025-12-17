# Logger Module

A comprehensive logging module for NestJS applications using Pino under the hood. Provides structured logging for HTTP requests/responses, RPC calls, WebSocket messages, and exceptions.

## Features

- ✅ **Pino-based logging** - High-performance structured logging
- ✅ **Automatic context detection** - No manual setup needed! Automatically captures request ID, user ID, service, and method names
- ✅ **HTTP request/response logging** - Automatic logging of all HTTP traffic
- ✅ **RPC logging** - Support for NestJS microservices
- ✅ **WebSocket logging** - Log WebSocket connections and messages
- ✅ **Exception filtering** - Automatic error logging with full context
- ✅ **Request ID tracking** - Correlation IDs for request tracing
- ✅ **Sensitive data redaction** - Automatic redaction of passwords, tokens, etc.
- ✅ **Pretty printing** - Human-readable logs in development
- ✅ **Environment-aware** - Different log levels and formats per environment

## Installation

The logger module is part of `@code-hive/nestjs`. Install dependencies:

```bash
pnpm install
```

## Basic Usage

### 1. Import and Configure the Logger Module

In your `app.module.ts`:

```typescript
import { Module } from '@nestjs/common';
import { LoggerModule } from '@code-hive/nestjs/logger';
import { Environments } from '@code-hive/nestjs/enums';

@Module({
  imports: [
    LoggerModule.forRoot({
      environment: Environments.DEVELOPMENT,
      appName: 'users-service',
      level: 'debug',
      prettyPrint: true,
    }),
  ],
})
export class AppModule {}
```

### 2. Use Logger Service in Your Code

**No setup needed!** The logger automatically detects context (service name, method name, request ID, user ID).

```typescript
import { Injectable } from '@nestjs/common';
import { LoggerService } from '@code-hive/nestjs/logger';

@Injectable()
export class UsersService {
  constructor(private readonly logger: LoggerService) {
    // No manual setup required!
    // Context is automatically detected from:
    // - Stack trace (service: "UsersService", method: "findUser")
    // - AsyncLocalStorage (requestId, userId from interceptors)
  }

  async findUser(id: string) {
    // Automatically includes: requestId, userId, service: "UsersService", method: "findUser"
    this.logger.info('Finding user', { userId: id });

    try {
      const user = await this.repository.findOne(id);
      this.logger.debug('User found', { userId: id, found: !!user });
      return user;
    } catch (error) {
      // Error logging automatically includes full context
      this.logger.error('Failed to find user', error);
      throw error;
    }
  }
}
```

### 3. Enable HTTP Request/Response Logging

In your `main.ts`:

```typescript
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { HttpLoggingInterceptor } from '@code-hive/nestjs/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable HTTP logging
  app.useGlobalInterceptors(
    new HttpLoggingInterceptor(app.get(LoggerService), {
      logRequestBody: true,
      logResponseBody: false, // Set to true if you need response bodies
      logQuery: true,
      logHeaders: false, // Usually contains sensitive data
      skipPaths: ['/health', '/metrics'], // Skip health checks
    })
  );

  await app.listen(3000);
}
bootstrap();
```

### 4. Enable Exception Logging

In your `main.ts`:

```typescript
import { ExceptionLoggingFilter } from '@code-hive/nestjs/logger';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  // Enable exception logging
  app.useGlobalFilters(new ExceptionLoggingFilter(app.get(LoggerService)));

  await app.listen(3000);
}
bootstrap();
```

### 5. Enable RPC Logging (for Microservices)

```typescript
import { RpcLoggingInterceptor } from '@code-hive/nestjs/logger';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useFactory: (logger: LoggerService) => {
        return new RpcLoggingInterceptor(logger, {
          logRequestData: true,
          logResponseData: false,
          skipPatterns: ['health_check'],
        });
      },
      inject: [LoggerService],
    },
  ],
})
export class AppModule {}
```

### 6. Enable WebSocket Logging

```typescript
import { WebSocketLoggingInterceptor } from '@code-hive/nestjs/logger';

@UseInterceptors(
  new WebSocketLoggingInterceptor(loggerService, {
    logMessageData: true,
    logClientInfo: true,
    skipEvents: ['ping', 'pong'],
  })
)
@WebSocketGateway()
export class ChatGateway {
  // ...
}
```

## Configuration Options

### LoggerModuleOptions

```typescript
interface LoggerModuleOptions {
  environment?: Environments; // 'development' | 'production' | 'test'
  appName?: string; // Application name
  level?: string; // 'trace' | 'debug' | 'info' | 'warn' | 'error' | 'fatal'
  prettyPrint?: boolean; // Enable pretty printing (default: true in dev)
  pinoOptions?: Partial<LoggerOptions>; // Additional Pino options
  redact?: string[]; // Fields to redact (default: password, token, etc.)
}
```

### HttpLoggingInterceptorOptions

```typescript
interface HttpLoggingInterceptorOptions {
  logRequestBody?: boolean; // Default: true
  logResponseBody?: boolean; // Default: false
  logQuery?: boolean; // Default: true
  logHeaders?: boolean; // Default: false
  maxBodyLength?: number; // Default: 1000
  skipPaths?: string[]; // Paths to skip
  skipMethods?: string[]; // HTTP methods to skip
}
```

## Log Levels

- `trace` - Very detailed logs
- `debug` - Debug information
- `info` - General information (default in production)
- `warn` - Warning messages
- `error` - Error messages
- `fatal` - Fatal errors

## Automatic Context Detection

The logger **automatically** captures context without any manual setup:

### What's Automatically Included

Every log entry automatically includes:

- **`requestId`** - Generated or from `x-request-id` / `x-correlation-id` headers
- **`userId`** - From authenticated user (if available)
- **`component`** - HTTP/RPC/WebSocket (set by interceptors)
- **`service`** - Class name (detected from stack trace, e.g., "UsersService")
- **`method`** - Method name (detected from stack trace, e.g., "findUser")

### How It Works

1. **AsyncLocalStorage** - Request context (requestId, userId) is stored automatically by interceptors
2. **Stack Trace Analysis** - Service and method names are detected from the call stack
3. **Zero Overhead** - Fast and efficient, no performance impact

### Request ID Tracking

The logger automatically generates and tracks request IDs. You can also provide your own:

```typescript
// In HTTP requests, set header:
headers: {
  'x-request-id': 'your-custom-id',
  // or
  'x-correlation-id': 'your-correlation-id',
}
```

The request ID is automatically included in all logs within that request scope.

## Sensitive Data Redaction

By default, the logger redacts:

- `password`
- `token`
- `authorization`
- `secret`
- `apiKey`
- `apikey`

You can customize this in the module options:

```typescript
LoggerModule.forRoot({
  redact: ['password', 'token', 'ssn', 'creditCard'],
});
```

## Log Output Examples

### Development (Pretty Print)

```
[2024-01-15 10:30:45.123] INFO: HTTP GET /api/users/123
    requestId: "req-1234567890-abc123"
    method: "GET"
    url: "/api/users/123"
    statusCode: 200
    duration: "45ms"
```

### Production (JSON)

```json
{
  "level": "info",
  "time": "2024-01-15T10:30:45.123Z",
  "context": "UsersService",
  "requestId": "req-1234567890-abc123",
  "userId": "user-123",
  "service": "UsersService",
  "method": "findUser",
  "httpMethod": "GET",
  "url": "/api/users/123",
  "statusCode": 200,
  "duration": "45ms",
  "msg": "HTTP GET /api/users/123 - 200"
}
```

Notice how all context (requestId, userId, service, method) is automatically included!

## Best Practices

1. **No manual context needed** - The logger automatically detects service, method, request ID, and user ID. Just inject and use!

   ```typescript
   // ✅ Good - Context is automatic
   constructor(private readonly logger: LoggerService) {}

   async findUser(id: string) {
     this.logger.info('Finding user', { userId: id });
     // Automatically includes: requestId, userId, service, method
   }
   ```

2. **Log at appropriate levels**:
   - `error` for errors that need attention
   - `warn` for warnings
   - `info` for important events
   - `debug` for detailed debugging

3. **Include relevant business context**:

   ```typescript
   // Add business-specific data, not structural context (that's automatic)
   this.logger.info('User created', { userId: user.id, email: user.email });
   ```

4. **Don't log sensitive data** - The logger redacts common fields, but be careful with custom fields

5. **Request IDs are automatic** - All logs in a request share the same requestId for easy correlation

6. **Skip verbose endpoints** like health checks and metrics using `skipPaths` option

## Integration with Other Services

The logger is designed to work seamlessly with:

- **APM tools** (e.g., Datadog, New Relic) - JSON logs can be parsed
- **Log aggregation** (e.g., ELK, Splunk) - Structured JSON format
- **Distributed tracing** - Request IDs can be used for correlation
