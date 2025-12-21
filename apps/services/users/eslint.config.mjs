import baseConfig from '../../../eslint.config.mjs';

export default [
  {
    ignores: [
      'jest.config.*',
      '*.config.js',
      '*.config.cjs',
      '*.config.mjs',
      '*.config.ts',
      'drizzle.config.ts',
    ],
  },
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
    ignores: ['drizzle.config.ts', '*.config.ts'],
    settings: {
      'import/resolver': {
        typescript: {
          alwaysTryTypes: true,
          project: ['./tsconfig.app.json'],
        },
      },
    },
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.app.json'],
      },
    },
  },
];

