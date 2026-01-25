import { tanstackStart } from '@tanstack/react-start/plugin/vite';
import react from '@vitejs/plugin-react';
import { nitro } from 'nitro/vite';
import { defineConfig, loadEnv } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import tsconfigPaths from 'vite-tsconfig-paths';

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, '../../', '');
  Object.assign(process.env, env);

  return {
    define: {
      'import.meta.env.VEMETRIC_TOKEN': JSON.stringify(env.VEMETRIC_TOKEN),
    },
    plugins: [
      tsconfigPaths(),
      tanstackStart({ srcDirectory: 'src' }),
      react(),
      nitro(),
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
            { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
            { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
            { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
            { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
          cleanupOutdatedCaches: true,
          navigateFallbackDenylist: [/^\/trpc/, /^\/auth/, /^\/paddle/, /^\/email/, /^\/api/],
        },
      }),
    ].filter(Boolean),
    server: {
      allowedHosts: ['app.vemetric.local', 'app.vemetric.localhost'],
      port: 4000,
      hmr:
        env.VEMETRIC_DEV_PROXY_DISABLED === 'true'
          ? undefined
          : {
              port: 4000,
            },
    },
  };
});
