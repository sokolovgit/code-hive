import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Inject, Optional } from '@nestjs/common';
import { ClsService } from 'nestjs-cls';
import { Observable } from 'rxjs';
import { tap, catchError } from 'rxjs/operators';

import { uuid } from '../../utils';
import { loggerContext } from '../logger.context';
import { LoggerService } from '../logger.service';

export interface WebSocketLoggingInterceptorOptions {
  /**
   * Log message data
   * @default true
   */
  logMessageData?: boolean;
  /**
   * Log client info
   * @default true
   */
  logClientInfo?: boolean;
  /**
   * Maximum length of data to log
   * @default 1000
   */
  maxDataLength?: number;
  /**
   * Skip logging for these events
   */
  skipEvents?: string[];
}

@Injectable()
export class WebSocketLoggingInterceptor implements NestInterceptor {
  private readonly logger: LoggerService;

  constructor(
    @Inject(LoggerService) loggerService: LoggerService,
    @Optional() private readonly cls?: ClsService,
    @Optional() private readonly options: WebSocketLoggingInterceptorOptions = {}
  ) {
    this.logger = loggerService;
  }

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const {
      logMessageData = true,
      logClientInfo = true,
      maxDataLength = 1000,
      skipEvents = ['ping', 'pong'],
    } = this.options;

    // Get WebSocket context
    const wsContext = context.switchToWs();
    const client = wsContext.getClient();
    const data = wsContext.getData();
    const pattern = wsContext.getPattern() || 'unknown';

    // Skip logging for specific events
    if (skipEvents.includes(pattern)) {
      return next.handle();
    }

    const startTime = Date.now();
    const requestId = uuid();

    const loggerCtx = {
      requestId,
      component: 'websocket',
    };

    // Set context in CLS if available
    if (this.cls) {
      const cls = this.cls;
      Object.entries(loggerCtx).forEach(([key, value]) => {
        if (value !== undefined) {
          cls.set(key, value);
        }
      });
    }

    return loggerContext.run(loggerCtx, () => {
      const requestLog: Record<string, unknown> = {
        event: pattern,
        ...(logClientInfo && {
          clientId: (client as { id?: string })?.id,
          clientIp: (client as { handshake?: { address?: string } })?.handshake?.address,
          clientHeaders: (client as { handshake?: { headers?: Record<string, unknown> } })
            ?.handshake?.headers,
        }),
        ...(logMessageData &&
          data && {
            data: this.truncateData(data, maxDataLength),
          }),
      };

      this.logger.info('WebSocket message received', requestLog);

      return next.handle().pipe(
        tap((responseData: unknown) => {
          const duration = Date.now() - startTime;
          const responseLog: Record<string, unknown> = {
            event: pattern,
            duration: `${duration}ms`,
          };
          if (responseData) {
            responseLog.responseData = this.truncateData(responseData, maxDataLength);
          }

          this.logger.info('WebSocket response', responseLog);
        }),
        catchError((error: unknown) => {
          const duration = Date.now() - startTime;
          const errorInfo: Record<string, unknown> = {
            name: error instanceof Error ? error.name : 'UnknownError',
            message: error instanceof Error ? error.message : 'Unknown error',
          };
          if (error instanceof Error && error.stack) {
            errorInfo.stack = error.stack;
          }

          const errorLog: Record<string, unknown> = {
            event: pattern,
            duration: `${duration}ms`,
            error: errorInfo,
          };

          this.logger.error('WebSocket error', undefined, 'WebSocketError');
          this.logger.info('WebSocket error details', errorLog);

          throw error;
        })
      );
    });
  }

  private truncateData(data: unknown, maxLength: number): unknown {
    if (!data) return data;

    const dataStr = JSON.stringify(data);
    if (dataStr.length <= maxLength) {
      return data;
    }

    return {
      _truncated: true,
      _originalLength: dataStr.length,
      _preview: dataStr.substring(0, maxLength) + '...',
    };
  }
}
