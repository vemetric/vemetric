import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    dir: './tests',
    reporters: ['verbose'],
    // The integration test files share one test Redis and ClickHouse database and clear them.
    fileParallelism: false,
  },
});
