import {
  Sampler,
  AlwaysOnSampler,
  AlwaysOffSampler,
  TraceIdRatioBasedSampler,
  ParentBasedSampler,
} from '@opentelemetry/sdk-trace-base';

export type SamplerConfig =
  | 'always'
  | 'never'
  | number
  | 'parent-always'
  | 'parent-ratio'
  | Sampler;

export interface SamplerFactoryOptions {
  sampler?: SamplerConfig;
  ratio?: number;
  parentRatio?: number;
}

/**
 * Creates a sampler based on configuration
 */
export function createSampler(options: SamplerFactoryOptions = {}): Sampler {
  const { sampler, ratio, parentRatio } = options;

  // If a custom sampler instance is provided, use it
  if (sampler && typeof sampler === 'object' && 'shouldSample' in sampler) {
    return sampler as Sampler;
  }

  // Handle string/number configurations
  if (sampler === 'always') {
    return new AlwaysOnSampler();
  }

  if (sampler === 'never') {
    return new AlwaysOffSampler();
  }

  if (sampler === 'parent-always') {
    return new ParentBasedSampler({
      root: new AlwaysOnSampler(),
    });
  }

  if (sampler === 'parent-ratio') {
    const sampleRatio = parentRatio ?? ratio ?? 0.1;
    return new ParentBasedSampler({
      root: new TraceIdRatioBasedSampler(sampleRatio),
    });
  }

  // Handle numeric ratio
  if (typeof sampler === 'number') {
    if (sampler < 0 || sampler > 1) {
      throw new Error('Sampler ratio must be between 0 and 1');
    }
    return new TraceIdRatioBasedSampler(sampler);
  }

  // If ratio is provided without sampler type, use it
  if (typeof ratio === 'number') {
    if (ratio < 0 || ratio > 1) {
      throw new Error('Sampler ratio must be between 0 and 1');
    }
    return new TraceIdRatioBasedSampler(ratio);
  }

  // Default: always on (for development)
  return new AlwaysOnSampler();
}

/**
 * Creates an environment-aware sampler
 * - Development: AlwaysOnSampler
 * - Production: TraceIdRatioBasedSampler with 10% sampling
 * - Test: AlwaysOffSampler (unless explicitly enabled)
 */
export function createEnvironmentSampler(
  environment?: string,
  customSampler?: SamplerConfig
): Sampler {
  if (customSampler) {
    return createSampler({ sampler: customSampler });
  }

  const env = environment || process.env.NODE_ENV || 'development';

  if (env === 'test') {
    return new AlwaysOffSampler();
  }

  if (env === 'production') {
    return new TraceIdRatioBasedSampler(0.1); // 10% sampling
  }

  // Development: sample everything
  return new AlwaysOnSampler();
}
