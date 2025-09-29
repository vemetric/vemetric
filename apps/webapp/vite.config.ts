import { TanStackRouterVite } from '@tanstack/router-plugin/vite';
import react from '@vitejs/plugin-react';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
  // Load env from parent directory for local development
  const env = loadEnv(mode, '../../', '');

  return {
    envDir: '../../',
    define: {
      'import.meta.env.VEMETRIC_TOKEN': env.VEMETRIC_TOKEN
        ? JSON.stringify(env.VEMETRIC_TOKEN)
        : import.meta.env.VITE_VEMETRIC_TOKEN,
    },
    plugins: [
      tsconfigPaths(),
      TanStackRouterVite({ target: 'react', autoCodeSplitting: true }),
      react(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon-196.png', 'apple-touch-icon-180x180.png', 'logo.svg', 'favicon.ico'],
        manifest: {
          name: 'Vemetric',
          short_name: 'Vemetric',
          description: 'Open-source web and product analytics platform',
          theme_color: '#ffffff',
          background_color: '#ffffff',
          display: 'standalone',
          orientation: 'portrait',
          scope: '/',
          start_url: '/',
          icons: [
            {
              src: 'pwa-64x64.png',
              sizes: '64x64',
              type: 'image/png',
            },
            {
              src: 'pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
            },
            {
              src: 'pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
            },
            {
              src: 'maskable-icon-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          cleanupOutdatedCaches: true,
        },
      }),
    ],
    server: {
      allowedHosts: ['app.vemetric.local', 'app.vemetric.localhost'],
      port: 4000,
      hmr: {
        port: 4000,
      },
    },
  };
});
