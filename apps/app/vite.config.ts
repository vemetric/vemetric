import { defineConfig } from 'vite';
import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import viteReact from '@vitejs/plugin-react';
import viteTsConfigPaths from 'vite-tsconfig-paths';
import { VitePWA } from 'vite-plugin-pwa';

const pwaPlugin = VitePWA({
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
      { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
      { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  },
  workbox: {
    globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
    cleanupOutdatedCaches: true,
    navigateFallbackDenylist: [/^\/trpc/, /^\/auth/, /^\/takeapaddle/, /^\/email/, /^\/up/],
    runtimeCaching: [
      {
        urlPattern: /^https:\/\/hub\.vemetric\.com\/.*/i,
        handler: 'NetworkOnly',
      },
    ],
  },
});

export default defineConfig({
  server: {
    port: 4000,
  },
  plugins: [
    viteTsConfigPaths(),
    tanstackStart(),
    // React's vite plugin must come after TanStack Start's plugin
    viteReact(),
    pwaPlugin,
  ],
});
