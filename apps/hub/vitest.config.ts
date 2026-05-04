import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    dir: './tests',
    exclude: ['**/*.integration.test.ts'],
    reporters: ['verbose'],
  },
});
