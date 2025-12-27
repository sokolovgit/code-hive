# OpenTelemetry Telemetry Module

A comprehensive OpenTelemetry module for NestJS applications, providing distributed tracing, metrics collection, and structured logging with trace correlation.

## Features

- ✅ **Three Pillars of Observability**: Traces, Metrics, and Logs
- ✅ **Automatic Instrumentation**: HTTP, NestJS, PostgreSQL, Redis, gRPC, and more
- ✅ **Manual Instrumentation**: Decorators (`@Span`, `@Trace`) and service methods
- ✅ **Resource Detection**: Automatic service, host, and cloud metadata detection
- ✅ **Context Propagation**: W3C Trace Context and Baggage support
- ✅ **Sampling Strategies**: Head-based and parent-based sampling
- ✅ **Multiple Exporters**: OTLP (gRPC/HTTP), Prometheus, Console
- ✅ **Security**: Sensitive data filtering and redaction
- ✅ **CLS Integration**: Seamless integration with nestjs-cls
- ✅ **Performance Optimized**: Batch processors and configurable sampling

## Installation

The module is included in `@code-hive/nestjs`. No additional installation needed.

## Quick Start

### 1. Early Initialization (Recommended)

Initialize OpenTelemetry in `main.ts` **before** any other imports to ensure auto-instrumentations patch modules before they load:

```typescript
import { loadEnv } from '@code-hive/nestjs/config';
loadEnv();

// Initialize OpenTelemetry early
import { initOpenTelemetry } from '@code-hive/nestjs/telemetry';
initOpenTelemetry();

// ... rest of imports
import { NestFactory } from '@nestjs/core';
// ...
```

### 2. Import the Module

```typescript
import { TelemetryModule } from '@code-hive/nestjs/telemetry';
import { ConfigModule } from '@code-hive/nestjs/config';
import { Module } from '@nestjs/common';

@Module({
  imports: [
    ConfigModule.forRoot({ ... }),
    TelemetryModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        serviceName: config.get('APP_NAME'),
        serviceVersion: config.get('APP_VERSION'),
        environment: config.get('NODE_ENV'),
        tracing: {
          enabled: true,
          sampler: config.get('NODE_ENV') === 'production' ? 0.1 : 'always',
          exporter: {
            type: 'otlp',
            protocol: 'grpc',
            endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
          },
        },
        metrics: {
          enabled: true,
          exporter: {
            type: 'prometheus',
            port: 9464,
          },
        },
        logs: {
          enabled: true,
          exporter: {
            type: 'otlp',
            protocol: 'grpc',
            endpoint: process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4317',
          },
        },
      }),
    }),
  ],
})
export class AppModule {}
```

### 3. Use Manual Instrumentation

```typescript
import { Injectable } from '@nestjs/common';
import { TelemetryService } from '@code-hive/nestjs/telemetry';
import { Span } from '@code-hive/nestjs/telemetry';

@Injectable()
export class UsersService {
  constructor(private readonly telemetry: TelemetryService) {}

  // Using decorator
  @Span({ name: 'users.find', attributes: { 'db.table': 'users' } })
  async findOne(id: string) {
    return this.db.select().from(users).where(eq(users.id, id));
  }

  // Using service method
  async createUser(data: CreateUserDto) {
    return this.telemetry.startSpan(
      'users.create',
      {
        attributes: { 'user.email': data.email },
      },
      async (span) => {
        const user = await this.db.insert(users).values(data).returning();
        span.setAttribute('user.id', user[0].id);
        return user[0];
      }
    );
  }
}
```

## Configuration

### Basic Configuration

```typescript
TelemetryModule.forRoot({
  serviceName: 'my-service',
  serviceVersion: '1.0.0',
  environment: 'production',
  tracing: {
    enabled: true,
    sampler: 0.1, // 10% sampling in production
    exporter: {
      type: 'otlp',
      protocol: 'grpc',
      endpoint: 'http://otel-collector:4317',
    },
  },
  metrics: {
    enabled: true,
    exporter: {
      type: 'prometheus',
      port: 9464,
    },
  },
});
```

### Advanced Configuration

```typescript
TelemetryModule.forRoot({
  serviceName: 'my-service',
  serviceVersion: '1.0.0',
  environment: 'production',

  // Tracing configuration
  tracing: {
    enabled: true,
    sampler: 'parent-ratio', // Parent-based sampling
    exporter: {
      type: 'otlp',
      protocol: 'http',
      endpoint: 'https://otel-collector.example.com',
      headers: {
        Authorization: 'Bearer token',
      },
    },
    processor: {
      type: 'batch',
      maxQueueSize: 4096,
      maxExportBatchSize: 512,
      scheduledDelayMillis: 5000,
    },
  },

  // Metrics configuration
  metrics: {
    enabled: true,
    exporter: {
      type: 'otlp',
      protocol: 'grpc',
      endpoint: 'http://otel-collector:4317',
    },
    exportIntervalMillis: 10000,
  },

  // Logs configuration
  logs: {
    enabled: true,
    exporter: {
      type: 'otlp',
      protocol: 'grpc',
      endpoint: 'http://otel-collector:4317',
    },
  },

  // Instrumentation configuration
  instrumentation: {
    enabled: true,
    nestjs: true,
    http: {
      enabled: true,
      captureHeaders: true,
      captureBodies: false, // Disable body capture for performance
      maxBodySize: 10000,
      ignorePaths: ['/health', '/metrics'],
    },
    pg: {
      enabled: true,
      captureQueryText: true,
      captureParameters: true,
      captureRowCount: true,
    },
    redis: true,
    grpc: true,
  },

  // Resource attributes
  resourceAttributes: {
    team: 'backend',
    component: 'api',
  },
});
```

## Decorators

### @Span() Decorator

Automatically creates a span for a method:

```typescript
import { Span } from '@code-hive/nestjs/telemetry';

@Span({
  name: 'users.find',
  attributes: { 'db.table': 'users' },
  includeArgs: true,
  includeResult: true,
})
async findOne(id: string) {
  // Method implementation
}
```

### @Trace() Decorator

Alias for `@Span()` for backward compatibility:

```typescript
import { Trace } from '@code-hive/nestjs/telemetry';

@Trace({ name: 'users.create' })
async createUser(data: CreateUserDto) {
  // Method implementation
}
```

## TelemetryService API

### Tracing

```typescript
// Start a span
await this.telemetry.startSpan(
  'operation.name',
  {
    attributes: { key: 'value' },
  },
  async (span) => {
    // Your code here
    span.setAttribute('result', 'success');
    return result;
  }
);

// Get active span
const span = this.telemetry.getActiveSpan();

// Get trace ID
const traceId = this.telemetry.getTraceId();

// Add event
this.telemetry.addEvent('important.milestone', { key: 'value' });

// Set attributes
this.telemetry.setAttributes({ key: 'value' });
```

### Metrics

```typescript
// Create a counter
const counter = this.telemetry.createCounter('requests_total', {
  description: 'Total number of requests',
});
counter.add(1, { method: 'GET', status: '200' });

// Create a histogram
const histogram = this.telemetry.createHistogram('request_duration_ms', {
  description: 'Request duration in milliseconds',
  unit: 'ms',
});
histogram.record(150, { method: 'GET' });

// Create an observable gauge
const gauge = this.telemetry.createObservableGauge(
  'memory_usage',
  {
    description: 'Memory usage in bytes',
  },
  (observable) => {
    observable.observe(process.memoryUsage().heapUsed, {});
  }
);
```

### Logs

```typescript
// Emit logs with trace correlation
this.telemetry.info('User created', { userId: '123' });
this.telemetry.warn('Rate limit approaching', { remaining: 10 });
this.telemetry.error('Failed to process', error, { context: 'payment' });
```

## Interceptors

The module provides several interceptors:

- **TraceInterceptor**: Automatically traces methods decorated with `@Span()` or `@Trace()`
- **HttpSpanInterceptor**: Enriches HTTP spans with response headers and bodies
- **MetricsInterceptor**: Collects HTTP metrics (latency, status codes, etc.)

```typescript
import {
  TraceInterceptor,
  HttpSpanInterceptor,
  MetricsInterceptor,
} from '@code-hive/nestjs/telemetry';

@Module({
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: TraceInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: HttpSpanInterceptor,
    },
    {
      provide: APP_INTERCEPTOR,
      useClass: MetricsInterceptor,
    },
  ],
})
export class AppModule {}
```

## Best Practices

### 1. Early Initialization

Always initialize OpenTelemetry in `main.ts` before other imports:

```typescript
// ✅ Good
import { initOpenTelemetry } from '@code-hive/nestjs/telemetry';
initOpenTelemetry();
import { NestFactory } from '@nestjs/core';

// ❌ Bad
import { NestFactory } from '@nestjs/core';
import { initOpenTelemetry } from '@code-hive/nestjs/telemetry';
initOpenTelemetry();
```

### 2. Sampling Strategy

- **Development**: Use `'always'` to sample all traces
- **Production**: Use `0.1` (10%) or `'parent-ratio'` for cost efficiency
- **High-traffic services**: Use lower sampling rates (0.01 - 0.05)

### 3. Sensitive Data

Never capture sensitive data in spans:

```typescript
// ❌ Bad
span.setAttribute('password', user.password);
span.setAttribute('credit_card', payment.cardNumber);

// ✅ Good
span.setAttribute('user.id', user.id);
span.setAttribute('payment.amount', payment.amount);
```

### 4. Performance

- Use batch processors in production
- Disable body capture for high-traffic endpoints
- Use appropriate sampling rates
- Monitor telemetry overhead

### 5. Resource Attributes

Add meaningful resource attributes:

```typescript
resourceAttributes: {
  'team': 'backend',
  'component': 'api',
  'datacenter': 'us-east-1',
}
```

## Environment Variables

The module respects standard OpenTelemetry environment variables:

- `OTEL_EXPORTER_OTLP_ENDPOINT`: OTLP endpoint URL
- `OTEL_SERVICE_NAME`: Service name
- `OTEL_SERVICE_VERSION`: Service version
- `OTEL_RESOURCE_ATTRIBUTES`: Additional resource attributes

## Troubleshooting

### Spans not appearing

1. Check that OpenTelemetry is initialized early in `main.ts`
2. Verify exporter endpoint is reachable
3. Check sampling configuration
4. Ensure instrumentation is enabled

### High memory usage

1. Reduce sampling rate
2. Disable body capture
3. Increase batch processor queue size
4. Use simple processor for debugging only

### Missing traces

1. Verify context propagation is configured
2. Check that spans are properly ended
3. Ensure parent spans exist for child spans
4. Verify exporter is working

## Migration from Old Implementation

The new implementation is backward compatible. Update your configuration to use the new options:

```typescript
// Old
TelemetryModule.forRoot({
  tracing: {
    sampler: 0.1,
    exporter: { type: 'otlp', endpoint: '...' },
  },
});

// New (same, but with more options)
TelemetryModule.forRoot({
  tracing: {
    sampler: 0.1,
    exporter: { type: 'otlp', endpoint: '...' },
  },
  metrics: { ... }, // New
  logs: { ... }, // New
});
```

## License

Part of `@code-hive/nestjs` package.
