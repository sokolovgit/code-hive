# OpenTelemetry Telemetry Module

This module provides comprehensive OpenTelemetry instrumentation for NestJS applications, enabling distributed tracing, metrics collection, and log correlation.

## Features

- ✅ **Automatic Instrumentation**: HTTP, PostgreSQL, Redis, and more
- ✅ **Manual Span Creation**: Easy-to-use API for custom spans
- ✅ **Trace-Log Correlation**: Automatic trace ID injection into logs
- ✅ **Metrics Collection**: Prometheus and OTLP exporters
- ✅ **Configurable Sampling**: Head-based sampling with configurable rates
- ✅ **Context Propagation**: W3C Trace Context support
- ✅ **CLS Integration**: Seamless integration with nestjs-cls

## Installation

The module is already included in `@code-hive/nestjs`. No additional installation needed.

## Quick Start

### 1. Import the Module

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
      }),
    }),
  ],
})
export class AppModule {}
```

### 2. Use Manual Instrumentation

```typescript
import { Injectable } from '@nestjs/common';
import { TelemetryService } from '@code-hive/nestjs/telemetry';

@Injectable()
export class UsersService {
  constructor(private readonly telemetry: TelemetryService) {}

  async findUser(id: string) {
    return this.telemetry.startSpan(
      'users.find',
      {
        attributes: {
          'user.id': id,
          'operation.type': 'read',
        },
      },
      async (span) => {
        // Your business logic here
        const user = await this.repository.findOne(id);

        // Add events to the span
        this.telemetry.addEvent('user.found', {
          'user.id': id,
          'user.exists': !!user,
        });

        return user;
      }
    );
  }
}
```

### 3. Access Trace Context

```typescript
import { Injectable } from '@nestjs/common';
import { TelemetryService } from '@code-hive/nestjs/telemetry';

@Injectable()
export class SomeService {
  constructor(private readonly telemetry: TelemetryService) {}

  async doSomething() {
    // Get current trace ID
    const traceId = this.telemetry.getTraceId();
    console.log('Current trace ID:', traceId);

    // Get current span ID
    const spanId = this.telemetry.getSpanId();
    console.log('Current span ID:', spanId);

    // Add attributes to current span
    this.telemetry.setAttributes({
      'custom.attribute': 'value',
    });
  }
}
```

## Configuration Options

### TelemetryModuleOptions

```typescript
interface TelemetryModuleOptions {
  // Enable/disable telemetry
  enabled?: boolean;

  // Service identification
  serviceName?: string;
  serviceVersion?: string;
  environment?: string;

  // Tracing configuration
  tracing?: {
    enabled?: boolean;
    sampler?: 'always' | 'never' | number | Sampler;
    exporter?: {
      type?: 'otlp' | 'console';
      protocol?: 'grpc' | 'http';
      endpoint?: string;
      headers?: Record<string, string>;
    };
  };

  // Metrics configuration
  metrics?: {
    enabled?: boolean;
    exporter?: {
      type?: 'otlp' | 'prometheus' | 'console';
      endpoint?: string;
      port?: number;
      headers?: Record<string, string>;
    };
  };

  // Auto-instrumentation
  instrumentation?: {
    enabled?: boolean;
    http?: boolean;
    pg?: boolean;
    redis?: boolean;
  };
}
```

## Environment Variables

The module respects standard OpenTelemetry environment variables:

- `OTEL_EXPORTER_OTLP_ENDPOINT`: OTLP endpoint URL (default: `http://localhost:4317`)
- `OTEL_SERVICE_NAME`: Service name (overrides `serviceName` option)
- `OTEL_RESOURCE_ATTRIBUTES`: Additional resource attributes

## Integration with Logger

The telemetry module automatically injects trace IDs into your logs via the existing logger context. No additional configuration needed!

```typescript
// In your service
this.logger.info('Processing request', { userId: '123' });
// Logs will automatically include traceId and spanId from the active span
```

## Observability Stack

The module is designed to work with the Grafana observability stack:

- **Tempo**: Distributed tracing backend
- **Prometheus**: Metrics collection
- **Loki**: Log aggregation (optional)
- **Grafana**: Visualization

See `infra/docker-compose.yml` for the complete setup.

## Best Practices

1. **Use Semantic Conventions**: Follow OpenTelemetry semantic conventions for attribute names
2. **Keep Spans Focused**: Create spans for meaningful operations, not every function call
3. **Set Appropriate Sampling**: Use lower sampling rates in production (10-20%)
4. **Correlate Logs**: Always include trace IDs in logs for correlation
5. **Monitor Performance**: Use metrics to track span creation overhead

## Examples

### Database Query Span

```typescript
async findUser(id: string) {
  return this.telemetry.startSpan('db.query', {
    attributes: {
      'db.system': 'postgresql',
      'db.operation': 'select',
      'db.table': 'users',
    },
  }, async () => {
    return this.db.query('SELECT * FROM users WHERE id = $1', [id]);
  });
}
```

### External API Call Span

```typescript
async callExternalAPI(url: string) {
  return this.telemetry.startSpan('http.request', {
    kind: SpanKind.CLIENT,
    attributes: {
      'http.method': 'GET',
      'http.url': url,
    },
  }, async (span) => {
    const response = await fetch(url);
    span.setAttribute('http.status_code', response.status);
    return response.json();
  });
}
```

## Troubleshooting

### Traces not appearing in Tempo

1. Check that the OTEL Collector is running: `docker ps | grep otel-collector`
2. Verify the endpoint URL matches your collector configuration
3. Check collector logs: `docker logs code-hive-otel-collector`

### High memory usage

1. Reduce sampling rate in production
2. Adjust batch processor settings in collector config
3. Use tail-based sampling for better resource utilization

### Missing spans

1. Ensure auto-instrumentation is enabled
2. Check that the instrumentation packages are installed
3. Verify spans are being created (use console exporter for debugging)

## Further Reading

- [OpenTelemetry Documentation](https://opentelemetry.io/docs/)
- [Grafana Tempo Documentation](https://grafana.com/docs/tempo/latest/)
- [OpenTelemetry Semantic Conventions](https://opentelemetry.io/docs/specs/semconv/)
