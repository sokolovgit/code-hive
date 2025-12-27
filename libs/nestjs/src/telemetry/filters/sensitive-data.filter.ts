/**
 * Common patterns for sensitive data
 */
export const SENSITIVE_PATTERNS = [
  'password',
  'passwd',
  'pwd',
  'secret',
  'token',
  'api_key',
  'apikey',
  'auth',
  'authorization',
  'credit_card',
  'creditcard',
  'card_number',
  'cvv',
  'cvc',
  'ssn',
  'social_security',
  'email',
  'phone',
  'phone_number',
  'address',
  'zip',
  'postal_code',
];

/**
 * Default redaction value
 */
export const REDACTED_VALUE = '[REDACTED]';

/**
 * Redact sensitive data from an object
 */
export function redactSensitiveData<T extends Record<string, unknown>>(
  data: T,
  patterns: string[] = SENSITIVE_PATTERNS,
  redactedValue: string = REDACTED_VALUE
): T {
  const redacted = { ...data };

  for (const key in redacted) {
    const lowerKey = key.toLowerCase();
    const isSensitive = patterns.some((pattern) => lowerKey.includes(pattern.toLowerCase()));

    if (isSensitive) {
      redacted[key] = redactedValue as T[Extract<keyof T, string>];
    } else if (
      typeof redacted[key] === 'object' &&
      redacted[key] !== null &&
      !Array.isArray(redacted[key])
    ) {
      // Recursively redact nested objects
      redacted[key] = redactSensitiveData(
        redacted[key] as Record<string, unknown>,
        patterns,
        redactedValue
      ) as T[Extract<keyof T, string>];
    }
  }

  return redacted;
}

/**
 * Redact sensitive data from a string (e.g., JSON)
 */
export function redactSensitiveDataFromString(
  data: string,
  patterns: string[] = SENSITIVE_PATTERNS,
  redactedValue: string = REDACTED_VALUE
): string {
  try {
    const parsed = JSON.parse(data);
    const redacted = redactSensitiveData(parsed, patterns, redactedValue);
    return JSON.stringify(redacted);
  } catch {
    // If not JSON, try to redact common patterns in the string
    let redacted = data;
    for (const pattern of patterns) {
      const regex = new RegExp(`"${pattern}":\\s*"[^"]*"`, 'gi');
      redacted = redacted.replace(regex, `"${pattern}":"${redactedValue}"`);
    }
    return redacted;
  }
}
