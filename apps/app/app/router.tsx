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

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof createRouter>;
  }
}
