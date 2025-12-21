import type { ScalarTheme } from '../types';

/**
 * Manages Scalar theme configuration
 */
export class ScalarThemeManager {
  /**
   * Get the theme name for Scalar
   * Scalar themes are applied via CSS imports from @scalar/themes
   */
  static getThemeName(theme: ScalarTheme): string {
    return theme;
  }

  /**
   * Get the CSS import path for a Scalar theme
   */
  static getThemeImportPath(theme: ScalarTheme): string {
    if (theme === 'none') {
      return '';
    }
    return `@scalar/themes/dist/${theme}.css`;
  }
}
