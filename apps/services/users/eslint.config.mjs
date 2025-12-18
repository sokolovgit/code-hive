import baseConfig from '../../../eslint.config.mjs';

export default [
  {
    ignores: [
      'jest.config.*',
      '*.config.js',
      '*.config.cjs',
      '*.config.mjs',
    ],
  },
  ...baseConfig,
  {
    files: ['**/*.ts', '**/*.tsx'],
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

