import baseConfig from '../../eslint.config.mjs';

export default [
  {
    ignores: ['dist/**', '*.config.js', '*.config.mjs'],
  },
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: ['./tsconfig.json'],
        },
      },
    },
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
      },
    },
  },
];

