import { Hono } from 'hono';
import { serveStatic } from 'hono/bun';
import { isNoCachePath } from './route-config';
import { logger } from './utils/logger';

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
      onNotFound: (path, c) => {
        const pathname = new URL(c.req.url).pathname;
        logger.info(
          { pathname, method: c.req.method, path },
          'Static file not found; falling through',
        );
      },
      rewriteRequestPath: (path) => {
        if (path === '/') {
          return '/index.html';
        }
        return path;
      },
      onFound: (_path, c) => {
        const pathname = new URL(c.req.url).pathname;
        if (pathname === '/') {
          logger.info({ pathname, method: c.req.method }, 'Serving index.html for root path');
        } else {
          logger.info({ pathname, method: c.req.method }, 'Serving static file');
        }
        setCacheHeaders(pathname, c);
      },
    }),
  );

  staticApp.get('*', async (c) => {
    const accept = c.req.header('accept') ?? '';
    const pathname = new URL(c.req.url).pathname;
    logger.info({ pathname, accept }, 'Static app fallback handler');
    if (accept.includes('text/html')) {
      applyIndexHtmlCacheHeaders(c);
      logger.info({ pathname }, 'Serving index.html for SPA fallback');
      return c.html(await Bun.file(indexHtmlPath).text());
    }

    logger.info({ pathname }, 'Returning 404 for non-HTML request');
    return c.text('Not Found', 404);
  });

  return staticApp;
}
