/** @type {import('jest').Config} */
module.exports = {
  moduleFileExtensions: ['js', 'json', 'ts'],
  roots: ['<rootDir>/src', '<rootDir>/prisma'],
  testRegex: '.*\\.spec\\.ts$',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }] },
  collectCoverageFrom: ['src/**/*.(t|j)s', 'prisma/exercise-import/**/*.(t|j)s'],
  coverageDirectory: 'coverage',
  testEnvironment: 'node',
};
