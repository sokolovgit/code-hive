import baseConfig from '../../../eslint.config.mjs';

export default [
  {
    ignores: ['dist/**', '*.config.js', '*.config.mjs'],
  },
  ...baseConfig,
];

