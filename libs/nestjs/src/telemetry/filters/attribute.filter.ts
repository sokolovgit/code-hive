import { AttributeValue } from '@opentelemetry/api';

import { filterAttributes } from '../utils/attribute.utils';

import { redactSensitiveData } from './sensitive-data.filter';

export interface AttributeFilterOptions {
  excludePatterns?: string[];
  redactSensitive?: boolean;
  sensitivePatterns?: string[];
}

/**
 * Filter and redact span attributes
 */
export function filterSpanAttributes(
  attributes: Record<string, AttributeValue>,
  options: AttributeFilterOptions = {}
): Record<string, AttributeValue> {
  let filtered = { ...attributes };

  // Exclude patterns
  if (options.excludePatterns && options.excludePatterns.length > 0) {
    filtered = filterAttributes(filtered, options.excludePatterns);
  }

  // Redact sensitive data
  if (options.redactSensitive !== false) {
    filtered = redactSensitiveData(filtered, options.sensitivePatterns) as Record<
      string,
      AttributeValue
    >;
  }

  return filtered;
}
