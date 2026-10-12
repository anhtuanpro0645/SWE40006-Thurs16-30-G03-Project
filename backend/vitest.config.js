import { defineConfig } from 'vitest/config';

// Coverage threshold (%): docs/CONVENTIONS.md asks for 70 in Week 9 and 80 from Week 10.
// Unit test coverage is already well above 80, so the Week 10 value is used from the start.
const COVERAGE_THRESHOLD = 80;

export default defineConfig({
  test: {
    environment: 'node',
    projects: [
      {
        extends: true,
        test: { name: 'unit', include: ['tests/unit/**/*.test.js'] },
      },
      {
        extends: true,
        test: {
          name: 'integration',
          include: ['tests/integration/**/*.test.js'],
          // Integration files share one database, so run them one at a time
          fileParallelism: false,
        },
      },
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'lcov', 'json-summary'],
      include: ['src/**/*.js'],
      exclude: ['src/server.js'],
      thresholds: {
        lines: COVERAGE_THRESHOLD,
        functions: COVERAGE_THRESHOLD,
        branches: COVERAGE_THRESHOLD,
        statements: COVERAGE_THRESHOLD,
      },
    },
  },
});
