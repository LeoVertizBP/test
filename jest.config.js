// jest.config.js
/** @type {import('ts-jest').JestConfigWithTsJest} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  // Automatically clear mock calls, instances, contexts and results before every test
  clearMocks: true,
  // Indicates whether the coverage information should be collected while executing the test
  collectCoverage: true,
  // The directory where Jest should output its coverage files
  coverageDirectory: "coverage",
  // An array of glob patterns indicating a set of files for which coverage information should be collected
  // collectCoverageFrom: ['src/**/*.{ts,tsx}', '!src/**/*.d.ts'],
  // A list of reporter names that Jest uses when writing coverage reports
  coverageReporters: ["json", "text", "lcov", "clover"],
  // The test pattern Jest uses to detect test files
  testMatch: ['**/__tests__/**/*.+(ts|tsx|js)', '**/?(*.)+(spec|test).+(ts|tsx|js)'],
  // An array of regexp pattern strings that are matched against all test paths, matched tests are skipped
  testPathIgnorePatterns: ['/dist/', '/frontend/', '/charts/'], // Keep ignoring build/frontend/charts output
  // Default: ['/node_modules/'] - We need to transform some node_modules
  transformIgnorePatterns: [
    // Transform ESM packages like get-port
    '/node_modules/(?!get-port)/', // Exclude node_modules except get-port
     // Keep ignoring build/frontend/charts output (redundant with testPathIgnorePatterns but safe)
    '/dist/',
    '/frontend/',
    '/charts/'
  ],
  // Indicates whether each individual test should be reported during the run
  verbose: true,
};
