import { createRouter as createTanStackRouter, parseSearchWith, stringifySearchWith } from '@tanstack/react-router';
import { parse, stringify } from 'jsurl2';
import { routeTree } from './routeTree.gen';

export function createRouter() {
  const router = createTanStackRouter({
    routeTree,
    trailingSlash: 'never',
    parseSearch: parseSearchWith(parse),
    stringifySearch: stringifySearchWith(stringify),
    scrollRestoration: true,
    defaultPreload: 'intent',
  });

  return router;
}

// For TanStack Start
let routerInstance: ReturnType<typeof createRouter> | null = null;

export function getRouter() {
  if (!routerInstance) {
    routerInstance = createRouter();
  }
  return routerInstance;
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
