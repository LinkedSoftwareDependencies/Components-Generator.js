import type { Config } from '@jest/types';

const config: Config.InitialOptions = {
  collectCoverage: true,
  coveragePathIgnorePatterns: [
    '/test/',
  ],
  coverageProvider: 'babel',
  coverageThreshold: {
    global: {
      branches: 100,
      functions: 100,
      lines: 100,
      statements: 100,
    },
  },
  moduleFileExtensions: [
    'ts',
    'js',
  ],
  testEnvironment: 'node',
  testMatch: [
    '<rootDir>/test/**/*.test.ts',
    '<rootDir>/packages/*/test/**/*-test.ts',
  ],
  transform: {
    '\\.ts$': 'ts-jest',
  },
};

export default config;
