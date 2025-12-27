import { readFileSync } from 'fs';
import * as os from 'os';
import { join } from 'path';

import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import pino, { Logger as PinoLogger, LoggerOptions } from 'pino';

import { Environments } from '../enums';

import { loggerContext, getCallerContext, getInfrastructureContext } from './logger.context';

export interface LoggerModuleOptions {
  /**
   * Environment name (development, production, test)
   */
  environment?: Environments;
  /**
   * Application name for log context
   */
  appName?: string;
  /**
   * Log level (trace, debug, info, warn, error, fatal)
   * @default 'info' in production, 'debug' in development
   */
  level?: string;
  /**
   * Enable pretty printing (useful for development)
   * @default true in development, false in production
   */
  prettyPrint?: boolean;
  /**
   * Additional Pino options
   */
  pinoOptions?: Partial<LoggerOptions>;
  /**
   * Redact sensitive fields from logs
   */
  redact?: string[];
  /**
   * Service version (defaults to package.json version)
   */
  serviceVersion?: string;
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: PinoLogger;
  private readonly context?: string;
  private readonly infrastructureContext: Record<string, unknown>;

  constructor(
    private readonly options: LoggerModuleOptions = {},
    context?: string
  ) {
    this.context = context;
    this.infrastructureContext = this.buildInfrastructureContext();
    this.logger = this.createLogger();
  }

  private buildInfrastructureContext(): Record<string, unknown> {
    const infra = getInfrastructureContext();
    const baseContext: Record<string, unknown> = {
      env:
        this.options.environment ||
        (process.env.NODE_ENV as Environments) ||
        Environments.DEVELOPMENT,
      app: this.options.appName || process.env.APP_NAME || 'nestjs-app',
      pid: process.pid,
      hostname: os.hostname(),
    };

    // Add version from options or package.json
    try {
      const packagePath = join(process.cwd(), 'package.json');
      const packageJson = JSON.parse(readFileSync(packagePath, 'utf-8'));
      baseContext.version = this.options.serviceVersion || packageJson.version || 'unknown';
    } catch {
      baseContext.version = this.options.serviceVersion || process.env.APP_VERSION || 'unknown';
    }

    // Merge with infrastructure context
    return { ...baseContext, ...infra };
  }

  private createLogger(): PinoLogger {
    const {
      environment = (process.env.NODE_ENV as Environments) || Environments.DEVELOPMENT,
      level,
      prettyPrint,
      pinoOptions = {},
      redact = [
        'password',
        'token',
        'authorization',
        'secret',
        'apiKey',
        'apikey',
        'cookie',
        'session',
      ],
    } = this.options;

    const isDevelopment = environment === Environments.DEVELOPMENT;
    const isTest = environment === Environments.TEST;

    const defaultOptions: LoggerOptions = {
      level: level || (isDevelopment ? 'debug' : 'info'),
      base: this.infrastructureContext,
      timestamp: pino.stdTimeFunctions.isoTime,
      formatters: {
        level: (label: string) => {
          return { level: label };
        },
      },
      redact: {
        paths: redact,
        remove: true,
      },
      ...(isTest && { enabled: false }), // Disable logging in tests unless explicitly enabled
    };

    // Pretty print in development
    if (prettyPrint !== undefined ? prettyPrint : isDevelopment) {
      return pino(
        {
          ...defaultOptions,
          ...pinoOptions,
        },
        pino.transport({
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'yyyy-mm-dd HH:MM:ss.l',
            ignore: 'pid,hostname,env,app,context',
            singleLine: false,
            hideObject: false,
          },
        })
      );
    }

    return pino({
      ...defaultOptions,
      ...pinoOptions,
    });
  }

  /**
   * Get automatic context from AsyncLocalStorage and stack trace
   * Filters out invalid context values and improves context extraction
   * Also includes OpenTelemetry trace context when available
   */
  private getAutoContext(): Record<string, unknown> {
    const context = loggerContext.getAll();
    const caller = getCallerContext();

    // Try to get trace context from OpenTelemetry if available
    const otelTraceContext: Record<string, unknown> = {};
    try {
      // Dynamic import to avoid requiring OpenTelemetry if not installed
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const { trace } = require('@opentelemetry/api');
      const activeSpan = trace.getActiveSpan();
      if (activeSpan) {
        const spanContext = activeSpan.spanContext();
        // Only use OpenTelemetry trace IDs if not already in context (OpenTelemetry is source of truth)
        if (!context.traceId && spanContext.traceId) {
          otelTraceContext.traceId = spanContext.traceId;
        }
        if (!context.spanId && spanContext.spanId) {
          otelTraceContext.spanId = spanContext.spanId;
        }
      }
    } catch {
      // OpenTelemetry not available, ignore
    }

    const autoContext: Record<string, unknown> = { ...context, ...otelTraceContext };

    // Only add service if it's meaningful (not internal framework class)
    // AND if component is not 'http' (HTTP logs shouldn't have service/method)
    if (caller.service && !context.service && context.component !== 'http') {
      const internalPatterns = [
        'Array',
        'Object',
        'Function',
        'Promise',
        'Logger',
        'OperatorSubscriber',
        'Subscriber',
      ];
      if (!internalPatterns.includes(caller.service)) {
        autoContext.service = caller.service;
      }
    }

    // Only add method if it's meaningful (not internal method)
    // AND if component is not 'http'
    if (caller.method && !context.method && context.component !== 'http') {
      const internalMethods = [
        'forEach',
        'map',
        'filter',
        'call',
        'apply',
        'next',
        'subscribe',
        'pipe',
      ];
      if (!internalMethods.includes(caller.method)) {
        autoContext.method = caller.method;
      }
    }

    // Clean up any invalid context values
    Object.keys(autoContext).forEach((key) => {
      const value = autoContext[key];
      if (
        value === 'Array' ||
        value === 'forEach' ||
        value === 'Object' ||
        value === 'OperatorSubscriber'
      ) {
        delete autoContext[key];
      }
    });

    return autoContext;
  }

  /**
   * Clean up log data by removing invalid values
   */
  private cleanLogData(logData: Record<string, unknown>): Record<string, unknown> {
    const cleaned: Record<string, unknown> = {};

    Object.keys(logData).forEach((key) => {
      const value = logData[key];
      // Skip invalid values and context field (we use service instead)
      if (
        value !== 'Array' &&
        value !== 'forEach' &&
        value !== 'Object' &&
        value !== 'OperatorSubscriber' &&
        value !== 'Subscriber' &&
        key !== 'context'
      ) {
        cleaned[key] = value;
      }
    });

    return cleaned;
  }

  /**
   * Log a message at the specified level
   * Enhanced to provide better context for NestJS lifecycle events
   */
  log(message: unknown, context?: string): void {
    const autoContext = this.getAutoContext();
    const rawMessage = typeof message === 'string' ? message : this.formatMessage(message);

    // Extract meaningful context from NestJS lifecycle messages
    let logContext = context || this.context || autoContext.service;

    // Parse NestJS lifecycle messages for better context
    if (typeof rawMessage === 'string') {
      // Handle "X dependencies initialized" messages
      const depsMatch = rawMessage.match(
        /(\w+Module|InstanceLoader|NestApplication|NestFactory)\s+(.+)/
      );
      if (depsMatch) {
        logContext = depsMatch[1];
      }
      // Handle "Starting Nest application" messages
      else if (rawMessage.includes('Starting Nest application')) {
        logContext = 'NestFactory';
      }
      // Handle "Nest application successfully started" messages
      else if (rawMessage.includes('successfully started')) {
        logContext = 'NestApplication';
      }
    }

    // Remove context from autoContext if present
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { context: _, ...cleanAutoContext } = autoContext;
    const logData = {
      ...cleanAutoContext,
    };

    // Format message with context
    const messageStr = this.formatMessage(message, { ...logData, context: logContext });

    this.logger.info(logData, messageStr);
  }

  /**
   * Log an error message
   */
  error(message: unknown, metaOrTrace?: string | Record<string, unknown>, context?: string): void {
    const autoContext = this.getAutoContext();
    const logContext = context || this.context || (autoContext.service as string);
    const errorContext = this.cleanLogData(autoContext);

    // Handle metadata or trace parameter
    let trace: string | undefined;
    let meta: Record<string, unknown> | undefined;

    if (metaOrTrace) {
      if (typeof metaOrTrace === 'string') {
        // Legacy: second parameter is trace string
        trace = metaOrTrace;
      } else if (typeof metaOrTrace === 'object') {
        // New: second parameter is metadata object
        meta = metaOrTrace;
      }
    }

    // Merge metadata if provided
    if (meta && typeof meta === 'object') {
      Object.keys(meta).forEach((key) => {
        const value = meta[key];
        if (
          value !== 'Array' &&
          value !== 'forEach' &&
          value !== 'Object' &&
          value !== 'OperatorSubscriber' &&
          value !== 'Subscriber' &&
          key !== 'context'
        ) {
          errorContext[key] = value;
        }
      });
    }

    if (trace) {
      // Format trace as array if it's a string
      const stackArray =
        typeof trace === 'string'
          ? trace
              .split('\n')
              .map((line) => line.trim())
              .filter(Boolean)
          : Array.isArray(trace)
            ? trace
            : undefined;

      if (stackArray) {
        errorContext.stack = stackArray;
      }
    }

    if (message instanceof Error) {
      // Format stack trace as array
      const stackArray = message.stack
        ? message.stack
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
        : undefined;

      const errorMeta: Record<string, unknown> = {
        ...errorContext,
        errorName: message.name,
        ...(stackArray && { stack: stackArray }),
        ...(typeof message.cause !== 'undefined' ? { cause: message.cause } : {}),
      };

      this.logger.error(
        errorMeta,
        this.formatMessage(message.message, { ...errorMeta, context: logContext })
      );
    } else {
      this.logger.error(
        errorContext,
        this.formatMessage(message, { ...errorContext, context: logContext })
      );
    }
  }

  /**
   * Log a warning message with optional metadata
   */
  warn(message: unknown, metaOrContext?: Record<string, unknown> | string, context?: string): void {
    const autoContext = this.getAutoContext();
    let logContext: string | undefined;
    let meta: Record<string, unknown> | undefined;

    // Handle overloaded parameters
    if (metaOrContext) {
      if (typeof metaOrContext === 'string') {
        // Legacy: second parameter is context string
        logContext = metaOrContext;
      } else if (typeof metaOrContext === 'object') {
        // New: second parameter is metadata object
        meta = metaOrContext;
        logContext = context;
      }
    } else {
      logContext = context;
    }

    logContext = logContext || this.context || (autoContext.service as string);
    const logData = this.cleanLogData(autoContext);

    // Merge metadata if provided
    if (meta && typeof meta === 'object') {
      Object.keys(meta).forEach((key) => {
        const value = meta[key];
        if (
          value !== 'Array' &&
          value !== 'forEach' &&
          value !== 'Object' &&
          value !== 'OperatorSubscriber' &&
          value !== 'Subscriber' &&
          key !== 'context'
        ) {
          logData[key] = value;
        }
      });
    }

    this.logger.warn(logData, this.formatMessage(message, { ...logData, context: logContext }));
  }

  /**
   * Log a debug message
   */
  debug(message: unknown, context?: string): void {
    const autoContext = this.getAutoContext();
    const logContext = context || this.context || (autoContext.service as string);
    const logData = this.cleanLogData(autoContext);

    this.logger.debug(logData, this.formatMessage(message, { ...logData, context: logContext }));
  }

  /**
   * Log a verbose message
   */
  verbose(message: unknown, context?: string): void {
    const autoContext = this.getAutoContext();
    const logContext = context || this.context || (autoContext.service as string);
    const logData = this.cleanLogData(autoContext);

    this.logger.trace(logData, this.formatMessage(message, { ...logData, context: logContext }));
  }

  /**
   * Log at info level with additional metadata
   * Enhanced to clean up and structure log data better
   */
  info(message: unknown, meta?: Record<string, unknown>, context?: string): void {
    const autoContext = this.getAutoContext();
    const logContext = context || this.context || (autoContext.service as string);
    let logData = this.cleanLogData(autoContext);

    // For HTTP component logs, exclude service and method (they're not relevant)
    // This must happen BEFORE merging meta to prevent meta from overriding
    if (logData.component === 'http') {
      delete logData.service;
      delete logData.method;
    }

    // Merge metadata, filtering out invalid values
    if (meta && typeof meta === 'object') {
      Object.keys(meta).forEach((key) => {
        const value = meta[key];
        // Skip invalid context values and context field
        if (
          value !== 'Array' &&
          value !== 'forEach' &&
          value !== 'Object' &&
          value !== 'OperatorSubscriber' &&
          value !== 'Subscriber' &&
          key !== 'context' &&
          // Don't allow meta to add service/method to HTTP logs
          !(logData.component === 'http' && (key === 'service' || key === 'method'))
        ) {
          logData[key] = value;
        }
      });
    }

    // Final cleanup
    logData = this.cleanLogData(logData);

    this.logger.info(logData, this.formatMessage(message, { ...logData, context: logContext }));
  }

  /**
   * Log at fatal level
   * FIXED: Now uses service instead of context field
   */
  fatal(message: unknown, context?: string): void {
    const autoContext = this.getAutoContext();
    const logContext = context || this.context || (autoContext.service as string);
    const logData = this.cleanLogData(autoContext);

    if (message instanceof Error) {
      // Format stack trace as array
      const stackArray = message.stack
        ? message.stack
            .split('\n')
            .map((line) => line.trim())
            .filter(Boolean)
        : undefined;

      this.logger.fatal(
        {
          ...logData,
          errorName: message.name,
          ...(stackArray && { stack: stackArray }),
          ...(typeof message.cause !== 'undefined' ? { cause: message.cause } : {}),
        },
        this.formatMessage(message.message, { ...logData, context: logContext })
      );
    } else {
      this.logger.fatal(logData, this.formatMessage(message, { ...logData, context: logContext }));
    }
  }

  /**
   * Get the underlying Pino logger instance
   */
  getPinoLogger(): PinoLogger {
    return this.logger;
  }

  /**
   * Format message with optional context information
   * Formats as: [context] message
   */
  private formatMessage(message: unknown, context?: Record<string, unknown>): string {
    let formatted: string;

    if (typeof message === 'string') {
      formatted = message;
    } else if (message instanceof Error && 'message' in message) {
      formatted = message.message;
    } else {
      formatted = JSON.stringify(message);
    }

    // Add context info to message at the start if available and not already included
    if (context) {
      const logContext = context.context as string;

      // Only add context if it exists and message doesn't already start with it
      if (logContext && typeof logContext === 'string') {
        const contextPrefix = `[${logContext}]`;
        if (!formatted.startsWith(contextPrefix)) {
          formatted = `${contextPrefix} ${formatted}`;
        }
      }
    }

    return formatted;
  }
}
