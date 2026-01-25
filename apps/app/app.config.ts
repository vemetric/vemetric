import { defineConfig } from '@tanstack/react-start/config';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  server: {
    preset: 'bun',
  },
  vite: {
    envDir: '../../',
    plugins: [
      viteTsConfigPaths(),
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
          navigateFallbackDenylist: [/^\/trpc/, /^\/auth/, /^\/paddle/, /^\/email/],
          runtimeCaching: [
            {
              urlPattern: /^https:\/\/hub\.vemetric\.com\/.*/i,
              handler: 'NetworkOnly',
            },
          ],
        },
      }),
    ],
    server: {
      allowedHosts: ['app.vemetric.local', 'app.vemetric.localhost'],
    },
  },
});
