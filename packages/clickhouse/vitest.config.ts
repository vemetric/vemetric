import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    dir: './tests',
    reporters: ['verbose'],
    // The ClickHouse integration files share one disposable database and truncate its tables.
    fileParallelism: false,
  },
});
