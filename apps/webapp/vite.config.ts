import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig({
  plugins: [tsconfigPaths(), TanStackRouterVite({ target: 'react', autoCodeSplitting: true }), react()],
  server: {
    allowedHosts: ['app.vemetric.local'],
  },
});
