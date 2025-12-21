export interface SwaggerAuthConfig {
  /**
   * Bearer token authentication configuration
   */
  bearer?: {
    name?: string;
    description?: string;
  };
  /**
   * Cookie authentication configuration
   */
  cookie?: {
    name?: string;
    description?: string;
  };
}
