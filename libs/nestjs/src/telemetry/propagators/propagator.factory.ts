import { TextMapPropagator } from '@opentelemetry/api';

export type PropagatorType = 'tracecontext' | 'baggage' | 'b3' | 'jaeger';

/**
 * Creates propagators for context propagation
 */
export function createPropagators(
  types: PropagatorType[] = ['tracecontext', 'baggage']
): TextMapPropagator[] {
  const propagators: TextMapPropagator[] = [];

  // Use the default propagators from the API
  // The propagation API handles W3C Trace Context and Baggage by default
  // For custom propagators, they would need to be added via propagation.setGlobalPropagator()

  // Return empty array - propagators are set globally via propagation API
  // This is a placeholder for future extensibility
  if (types.length === 0) {
    // Default propagators are already set by OpenTelemetry SDK
    return [];
  }

  // Note: Custom propagator implementation would go here
  // For now, we rely on the default W3C propagators

  return propagators;
}
