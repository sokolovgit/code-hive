import { AsyncLocalStorage } from 'async_hooks';

export interface LoggerContext {
  requestId?: string;
  userId?: string;
  component?: string;
  service?: string;
  method?: string;
  [key: string]: unknown;
}

class LoggerContextStore {
  private readonly storage = new AsyncLocalStorage<LoggerContext>();

  /**
   * Run a function with context
   */
  run<T>(context: LoggerContext, callback: () => T): T {
    return this.storage.run(context, callback);
  }

  /**
   * Get current context
   */
  get(): LoggerContext | undefined {
    return this.storage.getStore();
  }

  /**
   * Set context value
   */
  set(key: keyof LoggerContext, value: unknown): void {
    const store = this.storage.getStore();
    if (store) {
      store[key] = value as never;
    }
  }

  /**
   * Get context value
   */
  getValue<K extends keyof LoggerContext>(key: K): LoggerContext[K] | undefined {
    const store = this.storage.getStore();
    return store?.[key];
  }

  /**
   * Get all context
   */
  getAll(): LoggerContext {
    return this.storage.getStore() || {};
  }
}

export const loggerContext = new LoggerContextStore();

/**
 * Extract class and method name from stack trace
 */
export function getCallerContext(): { service?: string; method?: string } {
  const stack = new Error().stack;
  if (!stack) {
    return {};
  }

  const stackLines = stack.split('\n');

  // Skip the first few lines (Error, getCallerContext, logger method)
  // Look for the actual caller (usually a service or controller method)
  for (let i = 4; i < Math.min(stackLines.length, 15); i++) {
    const line = stackLines[i];
    if (!line) continue;

    // Match patterns like:
    // - "at ClassName.methodName (file:line:col)"
    // - "at ClassName.methodName"
    // - "at new ClassName"
    const match = line.match(/at\s+(?:new\s+)?([A-Z][a-zA-Z0-9_]*)\.[a-zA-Z0-9_$]+/);
    if (match && match[1]) {
      const className = match[1];

      // Skip internal logger/Node.js frames
      if (
        className.includes('Logger') ||
        className.includes('LoggerService') ||
        className === 'Object' ||
        className === 'Function' ||
        className === 'Promise'
      ) {
        continue;
      }

      // Extract method name
      const methodMatch = line.match(/\.([a-zA-Z0-9_$]+)\s*\(/);
      const methodName = methodMatch ? methodMatch[1] : undefined;

      return {
        service: className,
        method: methodName,
      };
    }
  }

  return {};
}
