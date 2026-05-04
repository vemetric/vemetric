import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    dir: './tests',
    hookTimeout: 30000,
    include: ['**/*.integration.test.ts'],
    reporters: ['verbose'],
    testTimeout: 30000,
  },
});
