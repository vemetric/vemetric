import { RouterProvider, createRouter, parseSearchWith, stringifySearchWith } from '@tanstack/react-router';
import { VemetricScript } from '@vemetric/react';
import { parse, stringify } from 'jsurl2';
import { createRoot } from 'react-dom/client';
import { ClientProviders } from './components/client-providers';
import { notFoundRoute } from './components/not-found-route';
import { Provider } from './components/ui/provider';
import { Toaster } from './components/ui/toaster';
import { routeTree } from './routeTree.gen';
import 'simplebar-react/dist/simplebar.min.css';

const router = createRouter({
  routeTree,
  defaultNotFoundComponent: notFoundRoute,
  trailingSlash: 'never',
  parseSearch: parseSearchWith(parse),
  stringifySearch: stringifySearchWith(stringify),
  scrollRestoration: true,
});

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const hostname = location.hostname.split('.').slice(-2).join('.');

createRoot(document.getElementById('root')!).render(
  <Provider>
    <ClientProviders>
      <VemetricScript
        host={'https://hub.' + hostname}
        token="WRlW37cPSLUAbXDk76wYU"
        maskPaths={[
          '/p/*',
          '/p/*/users',
          '/p/*/users/*',
          '/p/*/user/*',
          '/p/*/settings',
          '/p/*/funnels',
          '/p/*/funnels/*',
          '/p/*/events',
        ]}
      />
      <RouterProvider router={router} />
      <Toaster />
    </ClientProviders>
  </Provider>,
);
