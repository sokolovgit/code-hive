import { Injectable, LoggerService as NestLoggerService } from '@nestjs/common';
import pino, { Logger as PinoLogger, LoggerOptions } from 'pino';
import { Environments } from '../enums';
import { loggerContext, getCallerContext } from './logger.context';

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
}

@Injectable()
export class LoggerService implements NestLoggerService {
  private readonly logger: PinoLogger;
  private readonly context?: string;

  constructor(
    private readonly options: LoggerModuleOptions = {},
    context?: string
  ) {
    this.context = context;
    this.logger = this.createLogger();
  }

  private createLogger(): PinoLogger {
    const {
      environment = (process.env.NODE_ENV as Environments) || Environments.DEVELOPMENT,
      appName = process.env.APP_NAME || 'nestjs-app',
      level,
      prettyPrint,
      pinoOptions = {},
      redact = ['password', 'token', 'authorization', 'secret', 'apiKey', 'apikey'],
    } = this.options;

    const isDevelopment = environment === Environments.DEVELOPMENT;
    const isTest = environment === Environments.TEST;

    const defaultOptions: LoggerOptions = {
      level: level || (isDevelopment ? 'debug' : 'info'),
      base: {
        env: environment,
        app: appName,
        pid: process.pid,
      },
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
            translateTime: 'HH:MM:ss Z',
            ignore: 'pid,hostname',
            singleLine: false,
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
   */
  private getAutoContext(): Record<string, unknown> {
    const context = loggerContext.getAll();
    const caller = getCallerContext();

    return {
      ...context,
      ...(caller.service && !context.service && { service: caller.service }),
      ...(caller.method && !context.method && { method: caller.method }),
    };
  }

  /**
   * Log a message at the specified level
   */
  log(message: unknown, context?: string): void {
    const autoContext = this.getAutoContext();
    this.logger.info(
      {
        context: context || this.context || autoContext.service,
        ...autoContext,
      },
      this.formatMessage(message)
    );
  }

  /**
   * Log an error message
   */
  error(message: unknown, trace?: string, context?: string): void {
    const autoContext = this.getAutoContext();
    const errorContext = {
      context: context || this.context || autoContext.service,
      ...autoContext,
      ...(trace && { stack: trace }),
    };

    if (message instanceof Error) {
      this.logger.error(
        {
          ...errorContext,
          err: {
            message: message.message,
            stack: message.stack,
            name: message.name,
            ...(typeof message.cause !== 'undefined' ? { cause: message.cause } : {}),
          },
        },
        message.message
      );
    } else {
      this.logger.error(errorContext, this.formatMessage(message));
    }
  }

  /**
   * Log a warning message
   */
  warn(message: unknown, context?: string): void {
    const autoContext = this.getAutoContext();
    this.logger.warn(
      {
        context: context || this.context || autoContext.service,
        ...autoContext,
      },
      this.formatMessage(message)
    );
  }

  /**
   * Log a debug message
   */
  debug(message: unknown, context?: string): void {
    const autoContext = this.getAutoContext();
    this.logger.debug(
      {
        context: context || this.context || autoContext.service,
        ...autoContext,
      },
      this.formatMessage(message)
    );
  }

  /**
   * Log a verbose message
   */
  verbose(message: unknown, context?: string): void {
    const autoContext = this.getAutoContext();
    this.logger.trace(
      {
        context: context || this.context || autoContext.service,
        ...autoContext,
      },
      this.formatMessage(message)
    );
  }

  /**
   * Log at info level with additional metadata
   */
  info(message: unknown, meta?: Record<string, unknown>, context?: string): void {
    const autoContext = this.getAutoContext();
    const logData: Record<string, unknown> = {
      context: context || this.context || autoContext.service,
      ...autoContext,
    };
    if (meta && typeof meta === 'object') {
      Object.assign(logData, meta);
    }
    this.logger.info(logData, this.formatMessage(message));
  }

  /**
   * Log at fatal level
   */
  fatal(message: unknown, context?: string): void {
    const autoContext = this.getAutoContext();
    const logContext = {
      context: context || this.context || autoContext.service,
      ...autoContext,
    };

    if (message instanceof Error) {
      this.logger.fatal(
        {
          ...logContext,
          err: {
            message: message.message,
            stack: message.stack,
            name: message.name,
            ...(typeof message.cause !== 'undefined' ? { cause: message.cause } : {}),
          },
        },
        message.message
      );
    } else {
      this.logger.fatal(logContext, this.formatMessage(message));
    }
  }

  /**
   * Get the underlying Pino logger instance
   */
  getPinoLogger(): PinoLogger {
    return this.logger;
  }

  private formatMessage(message: unknown): string {
    if (typeof message === 'string') {
      return message;
    }
    if (message instanceof Error && 'message' in message) {
      return message.message;
    }
    return JSON.stringify(message);
  }
}
