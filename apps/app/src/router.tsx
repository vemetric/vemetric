import { createRouter, parseSearchWith, stringifySearchWith } from '@tanstack/react-router';
import { parse, stringify } from 'jsurl2';
import { errorRoute } from './components/error-route';
import { notFoundRoute } from './components/not-found-route';
import { routeTree } from './routeTree.gen';

export function getRouter() {
  return createRouter({
    routeTree,
    defaultNotFoundComponent: notFoundRoute,
    defaultErrorComponent: errorRoute,
    trailingSlash: 'never',
    parseSearch: parseSearchWith(parse),
    stringifySearch: stringifySearchWith(stringify),
    scrollRestoration: true,
  });
}

declare module '@tanstack/react-router' {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
