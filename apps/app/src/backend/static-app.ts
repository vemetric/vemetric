import { normalize } from 'node:path';
import { Hono } from 'hono';
import { getMimeType } from 'hono/utils/mime';
import { isNoCachePath } from './route-config';
import { logger } from './utils/logger';

type ResponseContext = { header: (name: string, value: string) => void; body: (data: ReadableStream) => Response };

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

const resolveStaticPath = (root: string, pathname: string): string => {
  const relativePath = pathname.startsWith('/') ? pathname.slice(1) : pathname;
  const normalizedPath = normalize(relativePath).replace(/^(\.\.(\/|\\|$))+/g, '');
  return `${root}/${normalizedPath}`;
};

const respondWithFile = (c: ResponseContext, filePath: string, requestPath: string) => {
  setCacheHeaders(requestPath, c);
  const mimeType = getMimeType(filePath);
  if (mimeType) {
    c.header('Content-Type', mimeType);
  }
  return c.body(Bun.file(filePath).stream());
};

export function createStaticApp() {
  const staticApp = new Hono();

  const webappDist = `${import.meta.dir}/../../dist`;
  const indexHtmlPath = `${webappDist}/index.html`;

  staticApp.use('*', async (c, next) => {
    const method = c.req.method;
    if (method !== 'GET' && method !== 'HEAD') {
      return next();
    }

    const pathname = new URL(c.req.url).pathname;
    if (pathname === '/') {
      logger.info({ pathname, method }, 'Serving index.html for root path');
      return respondWithFile(c, indexHtmlPath, pathname);
    }

    const filePath = resolveStaticPath(webappDist, pathname);
    const file = Bun.file(filePath);

    if (await file.exists()) {
      logger.info({ pathname, method, filePath }, 'Serving static file');
      return respondWithFile(c, filePath, pathname);
    }

    logger.info({ pathname, method, filePath }, 'Static file not found; falling through');
    return next();
  });

  staticApp.notFound(async (c) => {
    const accept = c.req.header('accept') ?? '';
    const pathname = new URL(c.req.url).pathname;
    logger.info({ pathname, accept }, 'Static app notFound handler');
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
