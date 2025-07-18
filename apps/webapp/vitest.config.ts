import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    dir: './tests',
    globals: true,
    environment: 'jsdom',
    reporters: ['verbose'],
  },
});
