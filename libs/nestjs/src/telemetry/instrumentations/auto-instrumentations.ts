import { IncomingMessage, ServerResponse } from 'http';

import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { Instrumentation } from '@opentelemetry/instrumentation';

import type { Span } from '@opentelemetry/api';

export interface AutoInstrumentationOptions {
  enabled?: boolean;
  http?:
    | boolean
    | {
        enabled?: boolean;
        captureHeaders?: boolean;
        captureBodies?: boolean;
        maxBodySize?: number;
        ignorePaths?: string[];
      };
  pg?:
    | boolean
    | {
        enabled?: boolean;
        captureParameters?: boolean;
        captureQueryText?: boolean;
        captureRowCount?: boolean;
      };
  redis?: boolean;
  grpc?: boolean;
  additional?: string[];
}

/**
 * Helper to safely capture body from request/response
 */
function captureBody(body: unknown, maxSize: number): string | undefined {
  if (!body) return undefined;

  try {
    let bodyStr: string;
    if (typeof body === 'string') {
      bodyStr = body;
    } else if (Buffer.isBuffer(body)) {
      bodyStr = body.toString('utf-8');
    } else if (typeof body === 'object') {
      bodyStr = JSON.stringify(body);
    } else {
      bodyStr = String(body);
    }

    if (bodyStr.length > maxSize) {
      return `${bodyStr.substring(0, maxSize)}... [truncated, original size: ${bodyStr.length} bytes]`;
    }
    return bodyStr;
  } catch {
    return '[unable to serialize body]';
  }
}

/**
 * Helper to check if path should be ignored
 */
function shouldIgnorePath(path: string, ignorePaths: string[]): boolean {
  return ignorePaths.some((ignorePath) => path.includes(ignorePath));
}

/**
 * Creates auto-instrumentations based on configuration
 */
export function createAutoInstrumentations(
  options: AutoInstrumentationOptions = {}
): Instrumentation[] {
  const {
    enabled = true,
    http,
    pg,
    redis = true,
    grpc = true,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    additional: _additional = [],
  } = options;

  if (!enabled) {
    return [];
  }

  // Parse HTTP instrumentation options
  const httpConfig = http;
  const httpEnabled = httpConfig !== false;
  const httpOptions = typeof httpConfig === 'object' ? httpConfig : {};

  const captureHeaders = httpOptions.captureHeaders !== false; // Default: true
  const captureBodies = httpOptions.captureBodies === true; // Default: false
  const maxBodySize = httpOptions.maxBodySize || 10000; // Default: 10KB
  const ignorePaths = httpOptions.ignorePaths || ['/health', '/metrics', '/healthz', '/ready'];

  // Parse PostgreSQL instrumentation options
  const pgConfig = pg;
  const pgEnabled = pgConfig !== false;
  const pgOptions = typeof pgConfig === 'object' ? pgConfig : {};

  const captureQueryText = pgOptions.captureQueryText !== false; // Default: true
  const captureRowCount = pgOptions.captureRowCount !== false; // Default: true

  // Get auto-instrumentations with configuration
  const instrumentations = getNodeAutoInstrumentations({
    '@opentelemetry/instrumentation-http': {
      enabled: httpEnabled,
      requestHook: (span: Span, request: IncomingMessage | unknown) => {
        if (!captureHeaders && !captureBodies) return;

        const req = request as IncomingMessage & {
          headers?: Record<string, string | string[]>;
          body?: unknown;
          url?: string;
        };

        // Capture request headers
        if (captureHeaders && req.headers) {
          const headers = req.headers;
          Object.keys(headers).forEach((key) => {
            const value = headers[key];
            if (value !== undefined) {
              span.setAttribute(
                `http.request.header.${key.toLowerCase()}`,
                Array.isArray(value) ? value.join(', ') : value
              );
            }
          });
        }

        // Capture request body (if available and not ignored)
        if (captureBodies && req.url) {
          const url = req.url || '';
          if (!shouldIgnorePath(url, ignorePaths)) {
            if (req.body !== undefined) {
              const bodyStr = captureBody(req.body, maxBodySize);
              if (bodyStr) {
                span.setAttribute('http.request.body', bodyStr);
              }
            }
          }
        }
      },
      responseHook: (span: Span, response: ServerResponse | IncomingMessage) => {
        if (!captureHeaders && !captureBodies) return;

        // Capture response headers
        if (captureHeaders) {
          try {
            let headers: Record<string, string | string[] | undefined> | undefined;

            if ('getHeaders' in response && typeof response.getHeaders === 'function') {
              headers = response.getHeaders() as Record<string, string | string[] | undefined>;
            } else if ('headers' in response) {
              headers = response.headers as Record<string, string | string[] | undefined>;
            }

            if (headers) {
              Object.keys(headers).forEach((key) => {
                const value = headers![key];
                if (value !== undefined) {
                  span.setAttribute(
                    `http.response.header.${key.toLowerCase()}`,
                    Array.isArray(value) ? value.join(', ') : String(value)
                  );
                }
              });
            }
          } catch {
            // Silently fail if headers can't be accessed
          }
        }
      },
    },
    '@opentelemetry/instrumentation-pg': {
      enabled: pgEnabled,
      requireParentSpan: false,
      enhancedDatabaseReporting: captureQueryText,
      addSqlCommenterCommentToQueries: false,
      responseHook: (span: Span, responseInfo: { data?: unknown; rowCount?: number }) => {
        if (captureRowCount && responseInfo.rowCount !== undefined) {
          span.setAttribute('db.rows_affected', responseInfo.rowCount);
          span.setAttribute('db.result.count', responseInfo.rowCount);
        }

        if (responseInfo.data !== undefined) {
          const resultType = Array.isArray(responseInfo.data) ? 'array' : typeof responseInfo.data;
          span.setAttribute('db.result.type', resultType);
          if (Array.isArray(responseInfo.data)) {
            span.setAttribute('db.result.length', responseInfo.data.length);
          }
        }
      },
    },
    '@opentelemetry/instrumentation-redis': {
      enabled: redis,
    },
    '@opentelemetry/instrumentation-grpc': {
      enabled: grpc,
    },
    // Note: fetch instrumentation is included in auto-instrumentations
    // but may not be configurable via the config map
    '@opentelemetry/instrumentation-dns': {
      enabled: true,
    },
    '@opentelemetry/instrumentation-net': {
      enabled: true,
    },
  });

  // Add additional instrumentations if specified
  // Note: These would need to be imported and configured separately
  // For now, we rely on getNodeAutoInstrumentations which includes most common ones

  return instrumentations;
}
