import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import { createApp } from 'vinxi';
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

export default createApp({
  server: {
    preset: 'bun',
    experimental: {
      asyncContext: true,
    },
  },
  routers: [
    {
      name: 'public',
      type: 'static',
      dir: './public',
    },
    {
      name: 'trpc',
      type: 'http',
      target: 'server',
      base: '/trpc',
      handler: './app/api-trpc.ts',
      plugins: () => [viteTsConfigPaths()],
    },
    {
      name: 'auth',
      type: 'http',
      target: 'server',
      base: '/auth',
      handler: './app/api-auth.ts',
      plugins: () => [viteTsConfigPaths()],
    },
    {
      name: 'health',
      type: 'http',
      target: 'server',
      base: '/up',
      handler: './app/api-health.ts',
      plugins: () => [viteTsConfigPaths()],
    },
    {
      name: 'paddle',
      type: 'http',
      target: 'server',
      base: '/takeapaddle',
      handler: './app/api-paddle.ts',
      plugins: () => [viteTsConfigPaths()],
    },
    {
      name: 'email',
      type: 'http',
      target: 'server',
      base: '/email',
      handler: './app/api-email.ts',
      plugins: () => [viteTsConfigPaths()],
    },
    {
      name: 'client',
      type: 'client',
      target: 'browser',
      handler: './app/client.tsx',
      base: '/_build',
      build: {
        sourcemap: true,
      },
      plugins: () => [
        viteTsConfigPaths(),
        ...tanstackStart({
          target: 'client',
          srcDirectory: 'app',
          vite: {
            installDevServerMiddleware: false,
          },
        }),
        pwaPlugin,
      ],
    },
    {
      name: 'ssr',
      type: 'http',
      target: 'server',
      handler: './app/ssr.tsx',
      plugins: () => [
        viteTsConfigPaths(),
        ...tanstackStart({
          target: 'server',
          srcDirectory: 'app',
          vite: {
            installDevServerMiddleware: false,
          },
        }),
      ],
    },
  ],
});
