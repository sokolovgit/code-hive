import {
  baseTheme,
  draculaTheme,
  gruvboxTheme,
  monokaiTheme,
  nordDarkTheme,
  oneDarkTheme,
  sepiaTheme,
  universalDarkTheme,
} from './swagger-ui';

import type { SwaggerUITheme } from '../types';

/**
 * Manages Swagger UI theme CSS
 */
export class SwaggerUIThemeManager {
  /**
   * Get the CSS for a given Swagger UI theme
   */
  static getThemeCss(theme: SwaggerUITheme): string {
    let css = baseTheme;

    switch (theme) {
      case 'dracula':
        css += '\n' + draculaTheme;
        break;
      case 'gruvbox':
        css += '\n' + gruvboxTheme;
        break;
      case 'nord-dark':
        css += '\n' + nordDarkTheme;
        break;
      case 'one-dark':
        css += '\n' + oneDarkTheme;
        break;
      case 'sepia':
        css += '\n' + sepiaTheme;
        break;
      case 'universal-dark':
        css += '\n' + universalDarkTheme;
        break;
      case 'monokai':
        css += '\n' + monokaiTheme;
        break;
      default:
        break;
    }

    return css;
  }
}
