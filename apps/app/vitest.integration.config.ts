import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['src/**/*.integration.test.ts'],
    globals: true,
    environment: 'node',
    reporters: ['verbose'],
  },
});
