export type SwaggerUITheme =
  | 'dracula'
  | 'gruvbox'
  | 'nord-dark'
  | 'one-dark'
  | 'sepia'
  | 'universal-dark'
  | 'monokai';

export interface SwaggerUIOptions {
  /**
   * Theme for the Swagger UI
   */
  theme?: SwaggerUITheme;

  /**
   * Additional Swagger UI setup options
   */
  swaggerOptions?: {
    explorer?: boolean;
    jsonDocumentUrl?: string;
    [key: string]: unknown;
  };
}
