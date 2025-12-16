import baseConfig from '../../../eslint.config.mjs';

export default [
  {
    ignores: [
      'webpack.config.js',
      'jest.config.*',
      '*.config.js',
      '*.config.cjs',
      '*.config.mjs',
    ],
  },
  ...baseConfig,
  {
    files: ['**/*.ts'],
    rules: {
      // Service-specific ESLint rules can be added here
    },
  },
];

