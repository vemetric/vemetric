import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { isNoCachePath } from './route-config';

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
        if (pathname.startsWith('/assets/')) {
          c.header('Cache-Control', 'public, max-age=31536000, immutable');
        } else if (pathname === '/' || pathname === '/index.html') {
          c.header('Cache-Control', 'no-cache');
          c.header('X-Frame-Options', 'DENY');
        } else if (isNoCachePath(pathname)) {
          c.header('Cache-Control', 'no-cache');
        } else {
          c.header('Cache-Control', 'public, max-age=3600');
        }
      },
    }),
  );

  staticApp.notFound(async (c) => {
    const accept = c.req.header('accept') ?? '';
    if (accept.includes('text/html')) {
      c.header('Cache-Control', 'no-cache');
      c.header('X-Frame-Options', 'DENY');
      return c.html(await Bun.file(indexHtmlPath).text());
    }
    return c.text('Not Found', 404);
  });

  return staticApp;
}
