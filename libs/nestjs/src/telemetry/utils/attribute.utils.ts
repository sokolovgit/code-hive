import { AttributeValue } from '@opentelemetry/api';

/**
 * Safely convert a value to an OpenTelemetry attribute value
 */
export function toAttributeValue(value: unknown): AttributeValue | undefined {
  if (value === null || value === undefined) {
    return undefined;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Array.isArray(value)) {
    // OpenTelemetry supports arrays of primitives
    if (value.length === 0) {
      return undefined;
    }
    const firstItem = value[0];
    if (
      typeof firstItem === 'string' ||
      typeof firstItem === 'number' ||
      typeof firstItem === 'boolean'
    ) {
      return value as AttributeValue;
    }
    // For complex arrays, convert to JSON string
    return JSON.stringify(value);
  }

  if (typeof value === 'object') {
    // Convert objects to JSON string
    try {
      return JSON.stringify(value);
    } catch {
      return '[unable to serialize]';
    }
  }

  return String(value);
}

/**
 * Filter attributes by key patterns
 */
export function filterAttributes(
  attributes: Record<string, AttributeValue>,
  excludePatterns: string[]
): Record<string, AttributeValue> {
  const filtered: Record<string, AttributeValue> = {};

  for (const [key, value] of Object.entries(attributes)) {
    const shouldExclude = excludePatterns.some((pattern) => {
      if (pattern.startsWith('/') && pattern.endsWith('/')) {
        // Regex pattern
        const regex = new RegExp(pattern.slice(1, -1));
        return regex.test(key);
      }
      // Simple string match
      return key.includes(pattern);
    });

    if (!shouldExclude) {
      filtered[key] = value;
    }
  }

  return filtered;
}
