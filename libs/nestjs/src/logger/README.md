# Logger Module

A comprehensive logging module for NestJS applications using Pino under the hood. Provides structured logging for HTTP requests/responses, RPC calls, WebSocket messages, and exceptions.

## Features

- ✅ **Pino-based logging** - High-performance structured logging
- ✅ **Automatic context detection** - No manual setup needed! Automatically captures request ID, user ID, service, and method names
- ✅ **CLS-based context** - Uses `nestjs-cls` for request-scoped context storage and propagation
- ✅ **HTTP request/response logging** - Automatic logging of all HTTP traffic
- ✅ **RPC logging** - Support for NestJS microservices
- ✅ **WebSocket logging** - Log WebSocket connections and messages
- ✅ **Exception filtering** - Automatic error logging with full context
- ✅ **Request ID tracking** - Correlation IDs for request tracing
- ✅ **Distributed tracing support** - OpenTelemetry trace context extraction
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
    // - CLS context (requestId, userId, traceId from interceptors)
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

1. **Continuation Local Storage (CLS)** - Request context (requestId, userId, traceId) is stored automatically by interceptors using `nestjs-cls`
2. **Stack Trace Analysis** - Service and method names are detected from the call stack
3. **Zero Overhead** - Fast and efficient, no performance impact
4. **Request-Scoped** - Context is automatically available throughout the entire request lifecycle

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

### Distributed Tracing Support

The logger automatically extracts and includes OpenTelemetry trace context from request headers:

**Supported Headers:**

- `traceparent` - W3C Trace Context (preferred)
- `x-trace-id` - Custom trace ID header
- `x-span-id` - Custom span ID header
- `x-parent-span-id` - Custom parent span ID header

**Example with OpenTelemetry:**

```typescript
// Client sends request with trace context
fetch('/api/users', {
  headers: {
    traceparent: '00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01',
  },
});

// Logger automatically extracts and includes in all logs:
// {
//   "traceId": "4bf92f3577b34da6a3ce929d0e0e4736",
//   "spanId": "00f067aa0ba902b7",
//   "requestId": "...",
//   ...
// }
```

The trace context is automatically propagated through the CLS context, so all logs in the request share the same trace information.

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

6. **Use CLS context for custom fields** - If you need to add custom context that should appear in all logs:

   ```typescript
   import { LoggerContextService } from '@code-hive/nestjs/logger';

   constructor(private readonly loggerContext: LoggerContextService) {}

   async processOrder(orderId: string) {
     // Set context that will appear in all subsequent logs
     this.loggerContext.set('orderId', orderId);
     this.loggerContext.set('tenantId', 'tenant-123');

     // All logs in this request will now include orderId and tenantId
     this.logger.info('Processing order');
   }
   ```

7. **Skip verbose endpoints** like health checks and metrics using `skipPaths` option

8. **Use trace context for distributed systems** - The logger automatically extracts OpenTelemetry trace context, so ensure your clients send `traceparent` headers

## Context Management

The logger uses `nestjs-cls` (Continuation Local Storage) for request-scoped context management. This provides several benefits:

### LoggerContextService

The module provides a `LoggerContextService` that manages context using CLS:

```typescript
import { LoggerContextService } from '@code-hive/nestjs/logger';

@Injectable()
export class MyService {
  constructor(private readonly loggerContext: LoggerContextService) {}

  async someMethod() {
    // Get current context
    const context = this.loggerContext.get();
    console.log(context.requestId, context.userId);

    // Set additional context
    this.loggerContext.set('tenantId', 'tenant-123');
    this.loggerContext.set('operationId', 'op-456');

    // Run code with specific context
    this.loggerContext.run(
      {
        requestId: 'custom-request-id',
        userId: 'user-123',
      },
      () => {
        // All logs in this scope will include the context
        this.logger.info('Operation started');
      }
    );
  }
}
```

### Available Context Fields

The logger context supports the following fields:

**Request Correlation:**

- `requestId` - Unique request identifier
- `correlationId` - Correlation ID for distributed systems
- `transactionId` - Database transaction ID
- `operationId` - Operation identifier
- `parentRequestId` - Parent request ID (for nested requests)
- `rootRequestId` - Root request ID

**Distributed Tracing:**

- `traceId` - OpenTelemetry trace ID
- `spanId` - Current span ID
- `parentSpanId` - Parent span ID
- `traceFlags` - Trace flags

**User Context:**

- `userId` - Authenticated user ID
- `userRole` - User role
- `sessionId` - Session identifier

**Service Context:**

- `component` - Component type ('http' | 'rpc' | 'ws')
- `service` - Service/class name
- `method` - Method name
- `serviceName` - Service name
- `serviceVersion` - Service version

**Business Context:**

- `tenantId` - Tenant identifier
- `organizationId` - Organization identifier
- `action` - Action being performed
- `resource` - Resource being accessed
- `resourceId` - Resource identifier
- `source` - Request source ('web' | 'mobile' | 'api' | 'cron')
- `clientId` - Client identifier

**Categorization:**

- `tags` - Array of tags
- `category` - Log category
- `subcategory` - Log subcategory
- `severity` - Severity level
- `featureFlags` - Active feature flags

### Integration with Drizzle Transactions

When using the Drizzle module with transactional support, the logger context is automatically integrated:

```typescript
import { DrizzleModule, DrizzleClsModule } from '@code-hive/nestjs/database/drizzle';
import { LoggerModule } from '@code-hive/nestjs/logger';

@Module({
  imports: [
    LoggerModule.forRootAsync({ ... }),
    DrizzleModule.forRootAsync({ ... }),
    DrizzleClsModule.forRoot(), // Shares CLS context with logger
  ],
})
export class AppModule {}
```

The logger and database transactions share the same CLS context, so:

- Request IDs are consistent across logs and database queries
- Transaction IDs can be logged automatically
- All operations in a request share the same context

## Integration with Other Services

The logger is designed to work seamlessly with:

- **APM tools** (e.g., Datadog, New Relic) - JSON logs can be parsed
- **Log aggregation** (e.g., ELK, Splunk) - Structured JSON format
- **Distributed tracing** - Request IDs and trace IDs for correlation
- **OpenTelemetry** - Automatic trace context extraction from headers
- **Database transactions** - Shared CLS context with Drizzle module
