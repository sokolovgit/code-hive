import baseConfig from '../../eslint.config.mjs';

export default [
  {
    ignores: ['dist/**', '*.config.js', '*.config.mjs'],
  },
  ...baseConfig,
  {
    files: ['*.ts', '*.tsx'],
    languageOptions: {
      parserOptions: {
        project: ['./tsconfig.json'],
        experimentalDecorators: true,
        emitDecoratorMetadata: true,
      },
    },
  },
];

