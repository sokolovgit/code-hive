import { Instrumentation } from '@opentelemetry/instrumentation';

/**
 * Creates NestJS-specific instrumentation
 * Note: This requires @opentelemetry/instrumentation-nestjs-core package
 */
export function createNestJSInstrumentation(enabled: boolean = true): Instrumentation | null {
  if (!enabled) {
    return null;
  }

  try {
    // Dynamic import to avoid requiring the package if not installed
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const { NestJSInstrumentation } = require('@opentelemetry/instrumentation-nestjs-core');
    return new NestJSInstrumentation();
  } catch {
    // Package not installed, return null
    return null;
  }
}
