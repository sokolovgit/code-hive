export type ScalarTheme =
  | 'alternate'
  | 'default'
  | 'moon'
  | 'purple'
  | 'solarized'
  | 'bluePlanet'
  | 'saturn'
  | 'kepler'
  | 'mars'
  | 'deepSpace'
  | 'laserwave'
  | 'none';

export interface ScalarOptions {
  /**
   * Theme for the Scalar UI
   */
  theme?: ScalarTheme;

  /**
   * Additional Scalar configuration options
   */
  scalarOptions?: {
    [key: string]: unknown;
  };
}
