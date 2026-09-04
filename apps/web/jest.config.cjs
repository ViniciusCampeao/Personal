/** @type {import('jest').Config} */
module.exports = {
  rootDir: '.',
  testEnvironment: '<rootDir>/test/jsdom-env.cjs',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.ts'],
  testMatch: ['<rootDir>/src/**/*.spec.{ts,tsx}'],
  // Must stay comfortably above `asyncUtilTimeout` in jest.setup.ts. When the two are
  // equal, Jest kills the test at the same moment a `findBy*`/`waitFor` gives up, so the
  // real assertion is never reported and every failure reads "Exceeded timeout of 5000
  // ms" — which hides the actual cause.
  testTimeout: 20_000,
  // TypeScript only: `@pt/shared` resolves to its compiled CommonJS `dist`, which Jest
  // requires as-is. Feeding those `.js` files to ts-jest just warns about `allowJs`.
  transform: {
    '^.+\\.tsx?$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.jest.json' }],
  },
  moduleNameMapper: {
    '\\.(css|less|scss)$': '<rootDir>/test/style-mock.cjs',
    '\\.(png|jpe?g|gif|webp|svg)$': '<rootDir>/test/file-mock.cjs',
    // Mirrors `paths` in tsconfig.app.json and `resolve.alias` in vite.config.ts.
    '^@/(.*)$': '<rootDir>/src/$1',
  },
};
