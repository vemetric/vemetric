import tsconfigPaths from 'vite-tsconfig-paths';
import { defineConfig } from 'vitest/config';

const include = ['src/**/*.{test,spec}.ts', 'src/**/*.{test,spec}.tsx'];
const exclude = ['src/**/*.integration.test.ts'];

export default defineConfig({
  plugins: [tsconfigPaths()],
  test: {
    globals: true,
    reporters: ['verbose'],
    projects: [
      {
        extends: true,
        test: {
          name: 'frontend',
          include,
          exclude: [...exclude, 'src/backend/**'],
          environment: 'jsdom',
        },
      },
      {
        extends: true,
        test: {
          name: 'backend',
          include: include.map((pattern) => pattern.replace('src/', 'src/backend/')),
          exclude,
          environment: 'node',
        },
      },
    ],
  },
});
