import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    dir: './tests',
    reporters: ['verbose'],
    // The Redis-backed integration files share one disposable Redis and flush it between tests.
    fileParallelism: false,
  },
});
