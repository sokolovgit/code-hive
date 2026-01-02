import * as os from 'os';

import { Injectable } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';

import { getAppVersion } from '../utils';

export interface LoggerContext {
  // Request correlation
  requestId?: string;
  correlationId?: string;
  transactionId?: string;
  operationId?: string;
  parentRequestId?: string;
  rootRequestId?: string;

  // Distributed tracing
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  traceFlags?: string;

  // User context
  userId?: string;
  userRole?: string;
  sessionId?: string;

  // Service context
  component?: string; // 'http' | 'rpc' | 'ws'
  service?: string;
  method?: string;
  serviceName?: string;
  serviceVersion?: string;

  // Business context
  tenantId?: string;
  organizationId?: string;
  action?: string;
  resource?: string;
  resourceId?: string;
  source?: string; // 'web' | 'mobile' | 'api' | 'cron'
  clientId?: string;

  // Tags and categorization
  tags?: string[];
  category?: string;
  subcategory?: string;
  severity?: string;
  featureFlags?: string[];

  [key: string]: unknown;
}

/**
 * Logger Context Service using nestjs-cls
 * Provides request-scoped context storage using Continuation Local Storage
 */
@Injectable()
export class LoggerContextService {
  constructor(private readonly cls: ClsService) {}

  /**
   * Run a function with context
   * If ClsService is available, uses CLS context
   * Otherwise, falls back to direct execution
   */
  run<T>(context: LoggerContext, callback: () => T): T {
    // Set all context values in CLS
    Object.entries(context).forEach(([key, value]) => {
      if (value !== undefined) {
        this.cls.set(key, value);
      }
    });
    return callback();
  }

  /**
   * Get current context
   */
  get(): LoggerContext | undefined {
    const store = this.cls.get();
    if (!store) {
      return undefined;
    }

    // Extract only LoggerContext keys
    const context: LoggerContext = {};
    const contextKeys: (keyof LoggerContext)[] = [
      'requestId',
      'correlationId',
      'transactionId',
      'operationId',
      'parentRequestId',
      'rootRequestId',
      'traceId',
      'spanId',
      'parentSpanId',
      'traceFlags',
      'userId',
      'userRole',
      'sessionId',
      'component',
      'service',
      'method',
      'serviceName',
      'serviceVersion',
      'tenantId',
      'organizationId',
      'action',
      'resource',
      'resourceId',
      'source',
      'clientId',
      'tags',
      'category',
      'subcategory',
      'severity',
      'featureFlags',
    ];

    contextKeys.forEach((key) => {
      const value = this.cls.get(key as string);
      if (value !== undefined) {
        context[key] = value as LoggerContext[typeof key];
      }
    });

    // Include any additional keys from store
    const storeKeys = Object.keys(store) as string[];
    storeKeys.forEach((key) => {
      if (!contextKeys.includes(key as keyof LoggerContext)) {
        const value = this.cls.get(key);
        if (value !== undefined) {
          context[key] = value as unknown;
        }
      }
    });

    return context;
  }

  /**
   * Set context value
   */
  set(key: keyof LoggerContext, value: unknown): void {
    if (value !== undefined) {
      this.cls.set(key as string, value);
    }
  }

  /**
   * Get context value
   */
  getValue<K extends keyof LoggerContext>(key: K): LoggerContext[K] | undefined {
    return this.cls.get(key as string) as LoggerContext[K] | undefined;
  }

  /**
   * Get all context
   */
  getAll(): LoggerContext {
    return this.get() || {};
  }
}

/**
 * Global logger context instance
 * Uses ClsService when available (injected via DI)
 * For backward compatibility, provides a singleton that can work without ClsService
 */
let globalLoggerContextService: LoggerContextService | null = null;

/**
 * Initialize logger context service (called by LoggerModule)
 */
export function setLoggerContextService(service: LoggerContextService): void {
  globalLoggerContextService = service;
}

/**
 * Get logger context service instance
 * @internal
 */
export function getLoggerContextService(): LoggerContextService | null {
  return globalLoggerContextService;
}

/**
 * Backward-compatible logger context wrapper
 * Uses global service instance if available
 */
export const loggerContext = {
  run<T>(context: LoggerContext, callback: () => T): T {
    const service = getLoggerContextService();
    if (service) {
      return service.run(context, callback);
    }
    // Fallback: execute without context
    return callback();
  },

  get(): LoggerContext | undefined {
    const service = getLoggerContextService();
    return service?.get();
  },

  set(key: keyof LoggerContext, value: unknown): void {
    const service = getLoggerContextService();
    service?.set(key, value);
  },

  getValue<K extends keyof LoggerContext>(key: K): LoggerContext[K] | undefined {
    const service = getLoggerContextService();
    return service?.getValue(key);
  },

  getAll(): LoggerContext {
    const service = getLoggerContextService();
    return service?.getAll() || {};
  },
};

/**
 * Get infrastructure context (hostname, pod, region, etc.)
 */
export function getInfrastructureContext(): Record<string, unknown> {
  return {
    hostname: os.hostname(),
    pod: process.env.POD_NAME,
    container: process.env.CONTAINER_ID,
    node: process.env.NODE_NAME,
    namespace: process.env.NAMESPACE || process.env.KUBERNETES_NAMESPACE,
    region: process.env.AWS_REGION || process.env.REGION || process.env.GCP_REGION,
    zone: process.env.AWS_AVAILABILITY_ZONE || process.env.GCP_ZONE,
    version: getAppVersion(),
    commit: process.env.GIT_COMMIT || process.env.COMMIT_SHA || process.env.GITHUB_SHA,
    build: process.env.BUILD_NUMBER || process.env.CI_BUILD_NUMBER,
    deployment: process.env.DEPLOYMENT_ID,
  };
}

/**
 * Extract trace context from headers (OpenTelemetry format)
 */
export function extractTraceContext(headers: Record<string, string | string[] | undefined>): {
  traceId?: string;
  spanId?: string;
  parentSpanId?: string;
  traceFlags?: string;
} {
  const traceparent = headers['traceparent'] || headers['x-traceparent'];
  const tracestate = headers['tracestate'] || headers['x-tracestate'];

  if (!traceparent || Array.isArray(traceparent)) {
    // Fallback to individual headers
    const traceId = headers['x-trace-id'] || headers['x-traceid'];
    const spanId = headers['x-span-id'] || headers['x-spanid'];
    const parentSpanId = headers['x-parent-span-id'] || headers['x-parent-spanid'];

    return {
      traceId: Array.isArray(traceId) ? traceId[0] : traceId,
      spanId: Array.isArray(spanId) ? spanId[0] : spanId,
      parentSpanId: Array.isArray(parentSpanId) ? parentSpanId[0] : parentSpanId,
      traceFlags: Array.isArray(tracestate) ? tracestate[0] : tracestate,
    };
  }

  // Parse traceparent: version-traceId-parentSpanId-traceFlags
  // Example: 00-4bf92f3577b34da6a3ce929d0e0e4736-00f067aa0ba902b7-01
  const parts = traceparent.split('-');
  if (parts.length >= 4) {
    return {
      traceId: parts[1],
      parentSpanId: parts[2],
      traceFlags: parts[3],
    };
  }

  return {};
}

/**
 * Internal NestJS/framework classes to skip when extracting context
 */
const INTERNAL_CLASSES = new Set([
  'Array',
  'Object',
  'Function',
  'Promise',
  'Logger',
  'LoggerService',
  'NestLogger',
  'Console',
  'Module',
  'InstanceLoader',
  'NestFactory',
  'NestApplication',
  'NestApplicationContext',
  'Router',
  'RouterExplorer',
  'RoutesResolver',
  'Injector',
  'ModuleRef',
  'Reflector',
  'MetadataScanner',
  'DependenciesScanner',
  'ModuleCompiler',
  'NestContainer',
  'ContextIdFactory',
  'ContextId',
  'ModuleTokenFactory',
  'ModuleDefinition',
  'UnknownModule',
  'UndefinedModule',
  'DynamicModule',
  'StaticModule',
  'AsyncLocalStorage',
  'AsyncResource',
  'EventEmitter',
  'Stream',
  'Readable',
  'Writable',
  'Transform',
  'Duplex',
  'PassThrough',
  'OperatorSubscriber', // RxJS internal
  'Subscriber', // RxJS internal
  'Observable', // RxJS internal
]);

/**
 * Internal method names to skip
 */
const INTERNAL_METHODS = new Set([
  'forEach',
  'map',
  'filter',
  'reduce',
  'find',
  'some',
  'every',
  'forEach',
  'call',
  'apply',
  'bind',
  'toString',
  'valueOf',
  'hasOwnProperty',
  'isPrototypeOf',
  'propertyIsEnumerable',
  'toLocaleString',
  'constructor',
  '__defineGetter__',
  '__defineSetter__',
  '__lookupGetter__',
  '__lookupSetter__',
  '__proto__',
  'next', // RxJS
  'error', // RxJS
  'complete', // RxJS
  'subscribe', // RxJS
  'pipe', // RxJS
  'tap', // RxJS
  'catchError', // RxJS
]);

/**
 * Extract class and method name from stack trace
 * Improved to filter out internal NestJS/framework calls
 */
export function getCallerContext(): { service?: string; method?: string } {
  const stack = new Error().stack;
  if (!stack) {
    return {};
  }

  const stackLines = stack.split('\n');

  // Skip the first few lines (Error, getCallerContext, logger method)
  // Look for the actual caller (usually a service or controller method)
  for (let i = 4; i < Math.min(stackLines.length, 20); i++) {
    const line = stackLines[i];
    if (!line) continue;

    // Skip lines from node_modules (except our own code)
    if (line.includes('node_modules') && !line.includes('code-hive')) {
      continue;
    }

    // Match patterns like:
    // - "at ClassName.methodName (file:line:col)"
    // - "at ClassName.methodName"
    // - "at new ClassName"
    // - "at async ClassName.methodName"
    const match = line.match(/at\s+(?:async\s+)?(?:new\s+)?([A-Z][a-zA-Z0-9_$]*)\.[a-zA-Z0-9_$]+/);
    if (match && match[1]) {
      const className = match[1];

      // Skip internal classes
      if (INTERNAL_CLASSES.has(className)) {
        continue;
      }

      // Extract method name
      const methodMatch = line.match(/\.([a-zA-Z0-9_$]+)\s*\(/);
      const methodName = methodMatch ? methodMatch[1] : undefined;

      // Skip internal methods
      if (methodName && INTERNAL_METHODS.has(methodName)) {
        continue;
      }

      // Additional check: skip if it looks like an internal NestJS pattern
      if (
        className.includes('Internal') ||
        className.includes('Abstract') ||
        className.includes('Operator')
      ) {
        continue;
      }

      return {
        service: className,
        method: methodName,
      };
    }

    // Also try to match standalone class names (for constructors)
    const constructorMatch = line.match(/at\s+new\s+([A-Z][a-zA-Z0-9_$]+)\s*\(/);
    if (constructorMatch && constructorMatch[1]) {
      const className = constructorMatch[1];
      if (
        !INTERNAL_CLASSES.has(className) &&
        !className.includes('Internal') &&
        !className.includes('Operator')
      ) {
        return {
          service: className,
          method: 'constructor',
        };
      }
    }
  }

  return {};
}

/**
 * Get status code category
 */
export function getStatusCategory(statusCode: number): string {
  if (statusCode >= 200 && statusCode < 300) return '2xx';
  if (statusCode >= 300 && statusCode < 400) return '3xx';
  if (statusCode >= 400 && statusCode < 500) return '4xx';
  if (statusCode >= 500) return '5xx';
  return 'unknown';
}

/**
 * Get response time bucket for performance analysis
 */
export function getTimeBucket(durationMs: number): string {
  if (durationMs < 100) return '0-100ms';
  if (durationMs < 500) return '100-500ms';
  if (durationMs < 1000) return '500-1000ms';
  if (durationMs < 5000) return '1-5s';
  return '5s+';
}
