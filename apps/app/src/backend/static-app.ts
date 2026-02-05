import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { isNoCachePath } from './route-config';

const applyIndexHtmlCacheHeaders = (c: { header: (name: string, value: string) => void }) => {
  c.header('Cache-Control', 'no-cache');
  c.header('X-Frame-Options', 'DENY');
};

const setCacheHeaders = (pathname: string, c: { header: (name: string, value: string) => void }) => {
  if (pathname.startsWith('/assets/') || pathname.startsWith('/workbox-')) {
    c.header('Cache-Control', 'public, max-age=31536000, immutable');
  } else if (pathname === '/' || pathname === '/index.html') {
    applyIndexHtmlCacheHeaders(c);
  } else if (isNoCachePath(pathname)) {
    c.header('Cache-Control', 'no-cache');
  } else {
    c.header('Cache-Control', 'public, max-age=3600');
  }
};

export function createStaticApp() {
  const staticApp = new Hono();

  const webappDist = `${import.meta.dir}/../../dist`;
  const indexHtmlPath = `${webappDist}/index.html`;

  staticApp.use(
    '*',
    serveStatic({
      root: webappDist,
      onFound: (_path, c) => {
        const pathname = new URL(c.req.url).pathname;
        setCacheHeaders(pathname, c);
      },
    }),
  );

  staticApp.get('*', async (c) => {
    const accept = c.req.header('accept') ?? '';
    if (accept.includes('text/html')) {
      applyIndexHtmlCacheHeaders(c);
      return c.html(await Bun.file(indexHtmlPath).text());
    }

    return c.text('Not Found', 404);
  });

  return staticApp;
}
