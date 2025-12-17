# Logger Module Design Document

## Architecture Overview

The logger module is built on top of **Pino**, a high-performance structured logger for Node.js. It provides a comprehensive logging solution for NestJS applications with support for HTTP, RPC, and WebSocket protocols.

## Design Decisions

### 1. Why Pino?

- **Performance**: Pino is one of the fastest Node.js loggers (asynchronous logging)
- **Structured Logging**: JSON output by default, perfect for log aggregation
- **Ecosystem**: Well-supported with many transports and integrations
- **Production Ready**: Used by major companies in production

### 2. Module Structure

```
logger/
├── logger.service.ts          # Core logger service (Pino wrapper)
├── logger.module.ts           # NestJS module definition
├── logger.constants.ts        # Injection tokens
├── interceptors/
│   ├── http-logging.interceptor.ts
│   ├── rpc-logging.interceptor.ts
│   └── ws-logging.interceptor.ts
├── filters/
│   └── exception-logging.filter.ts
└── index.ts                   # Public exports
```

### 3. Key Features Implemented

#### ✅ Request/Response Logging

- HTTP: Full request/response logging with configurable verbosity
- RPC: Microservices pattern and data logging
- WebSocket: Event and message logging

#### ✅ Error Logging

- Global exception filter catches all errors
- Context-aware error logging (HTTP, RPC, WS)
- Stack traces and error details preserved

#### ✅ Request ID Tracking

- Automatic generation of request IDs
- Support for custom correlation IDs via headers
- Request ID propagation in logs

#### ✅ Sensitive Data Redaction

- Automatic redaction of common sensitive fields
- Configurable redaction list
- Safe logging of request/response bodies

#### ✅ Environment-Aware Configuration

- Pretty printing in development
- JSON output in production
- Configurable log levels per environment

## Proposed Enhancements

### 1. **Log Sampling/Rate Limiting** 🎯

**Problem**: High-traffic endpoints can generate excessive logs.

**Solution**: Add rate limiting to prevent log flooding:

```typescript
HttpLoggingInterceptorOptions {
  sampleRate?: number; // 0.0 to 1.0, e.g., 0.1 = 10% of requests
  maxLogsPerMinute?: number; // Per endpoint
}
```

### 2. **Structured Error Context** 🎯

**Problem**: Errors sometimes lack sufficient context.

**Solution**: Automatically capture:

- User ID (if authenticated)
- Request body/query params
- Database query (if applicable)
- Service dependencies called

### 3. **Performance Metrics** 🎯

**Problem**: Need to track slow requests automatically.

**Solution**: Add automatic slow request detection:

```typescript
HttpLoggingInterceptorOptions {
  slowRequestThreshold?: number; // ms, default: 1000
  logSlowRequests?: boolean; // default: true
}
```

### 4. **Log Transports** 🎯

**Problem**: Need to send logs to external services (Datadog, CloudWatch, etc.).

**Solution**: Add transport support:

```typescript
LoggerModule.forRoot({
  transports: [
    pino.transport({
      target: 'pino-datadog',
      options: { apiKey: 'xxx' },
    }),
  ],
});
```

### 5. **Request Context Storage** 🎯

**Problem**: Need to access request context in services.

**Solution**: Use AsyncLocalStorage for request context:

```typescript
// Automatically available in all services
this.logger.info('Processing user', {
  requestId: RequestContext.getRequestId(),
  userId: RequestContext.getUserId(),
});
```

### 6. **Log Aggregation Helpers** 🎯

**Problem**: Need to correlate logs across services.

**Solution**: Add distributed tracing support:

```typescript
// Automatically include trace ID from headers
headers: {
  'x-trace-id': 'trace-123',
  'x-span-id': 'span-456'
}
```

### 7. **Audit Logging** 🎯

**Problem**: Need to log security-sensitive operations.

**Solution**: Add audit log decorator:

```typescript
@AuditLog({ action: 'user.deleted', resource: 'user' })
async deleteUser(id: string) {
  // Automatically logs with full context
}
```

### 8. **Log Levels per Component** 🎯

**Problem**: Different components need different log levels.

**Solution**: Allow per-component log levels:

```typescript
LoggerModule.forRoot({
  componentLevels: {
    http: 'info',
    database: 'debug',
    cache: 'warn',
  },
});
```

### 9. **Request Body Size Limits** 🎯

**Problem**: Large request bodies can cause memory issues.

**Solution**: Add size limits and truncation:

```typescript
HttpLoggingInterceptorOptions {
  maxBodySize?: number; // bytes, default: 1MB
  truncateLargeBodies?: boolean; // default: true
}
```

### 10. **Custom Log Formatters** 🎯

**Problem**: Need custom log formats for specific use cases.

**Solution**: Allow custom formatters:

```typescript
LoggerModule.forRoot({
  formatters: {
    log: (object) => {
      // Custom formatting logic
      return object;
    },
  },
});
```

## Implementation Priority

### High Priority (Recommended for Production)

1. ✅ **Request ID Tracking** - Already implemented
2. ✅ **Sensitive Data Redaction** - Already implemented
3. 🎯 **Log Sampling** - Prevents log flooding
4. 🎯 **Performance Metrics** - Critical for monitoring
5. 🎯 **Request Context Storage** - Improves developer experience

### Medium Priority (Nice to Have)

6. 🎯 **Log Transports** - For external log aggregation
7. 🎯 **Structured Error Context** - Better debugging
8. 🎯 **Log Aggregation Helpers** - For distributed systems

### Low Priority (Future Enhancements)

9. 🎯 **Audit Logging** - For compliance requirements
10. 🎯 **Custom Formatters** - For specific use cases

## Usage Patterns

### Pattern 1: Service-Level Logging

```typescript
@Injectable()
export class UsersService {
  private readonly logger: LoggerService;

  constructor(logger: LoggerService) {
    this.logger = logger.child({ service: 'UsersService' });
  }

  async findUser(id: string) {
    this.logger.info('Finding user', { userId: id });
    // ...
  }
}
```

### Pattern 2: Method-Level Logging

```typescript
async findUser(id: string) {
  const methodLogger = this.logger.child({ method: 'findUser' });
  methodLogger.debug('Entering findUser', { userId: id });
  // ...
}
```

### Pattern 3: Error Logging

```typescript
try {
  // ...
} catch (error) {
  this.logger.error('Failed to find user', error, 'UsersService');
  throw error;
}
```

## Performance Considerations

1. **Asynchronous Logging**: Pino logs asynchronously, so it won't block your application
2. **JSON Serialization**: Only serialize what you need (avoid large objects)
3. **Log Level**: Use appropriate log levels (debug in dev, info in prod)
4. **Sampling**: Consider sampling for high-traffic endpoints
5. **Redaction**: Redaction happens at serialization time, minimal overhead

## Security Considerations

1. **Sensitive Data**: Always redact passwords, tokens, API keys
2. **PII**: Be careful with personally identifiable information
3. **Headers**: Don't log all headers by default (can contain sensitive data)
4. **Stack Traces**: Stack traces in production should be sanitized
5. **Error Messages**: Don't expose internal error details to logs in production

## Testing

The logger is disabled by default in test environment. To enable:

```typescript
LoggerModule.forRoot({
  environment: Environments.TEST,
  // ... other options
});
```

## Migration from NestJS Logger

If you're migrating from NestJS's built-in logger:

1. Replace `Logger` with `LoggerService`
2. Update log calls to use structured format
3. Add interceptors for automatic request/response logging
4. Add exception filter for error logging

Example:

```typescript
// Before
this.logger.log('User created', 'UsersService');

// After
this.logger.info('User created', { service: 'UsersService' }, 'UsersService');
```

## Questions for Discussion

1. **Log Retention**: Should we add automatic log rotation/retention policies?
2. **Log Aggregation**: Which service should we integrate with first? (Datadog, CloudWatch, ELK?)
3. **Sampling Strategy**: What sampling rate should we use by default?
4. **Error Alerting**: Should we add integration with alerting systems?
5. **Compliance**: Do we need audit logging for compliance (GDPR, HIPAA, etc.)?
