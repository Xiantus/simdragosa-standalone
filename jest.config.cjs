/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        module: 'CommonJS',
        moduleResolution: 'node',
        target: 'ES2022',
        esModuleInterop: true,
        skipLibCheck: true,
        strict: false,
      }
    }]
  },
  testMatch: ['**/src/main/**/*.test.ts', '**/src/preload/**/*.test.ts'],
  moduleNameMapper: {
    '^@shared/(.*)$': '<rootDir>/src/shared/$1',
    '^electron$': '<rootDir>/src/__mocks__/electron.ts'
  },
  testPathIgnorePatterns: ['/node_modules/', '/out/']
}
