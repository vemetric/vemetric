import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    include: ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx'],
    globals: true,
    environment: 'jsdom',
    environmentMatchGlobs: [['src/backend/**', 'node']],
    reporters: ['verbose'],
  },
});
