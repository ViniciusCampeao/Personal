/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: '<rootDir>/test/jsdom-env.cjs',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/src/**/*.spec.{ts,tsx}'],
  transform: {
    '^.+\\.(t|j)sx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss)$': '<rootDir>/test/style-mock.cjs',
  },
};
