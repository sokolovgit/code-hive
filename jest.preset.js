export default {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.base.json' }],
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'apps/**/*.{ts,tsx}',
    'libs/**/*.{ts,tsx}',
    '!**/*.d.ts',
    '!**/*.spec.ts',
    '!**/*.test.ts',
  ],
};
