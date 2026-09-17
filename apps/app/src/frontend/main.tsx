import { RouterProvider, createRouter, parseSearchWith, stringifySearchWith } from '@tanstack/react-router';
import { VemetricScript } from '@vemetric/react';
import { parse, stringify } from 'jsurl2';
import { createRoot } from 'react-dom/client';
import { registerSW } from 'virtual:pwa-register';
import { ClientProviders } from './components/client-providers';
import { errorRoute } from './components/error-route';
import { notFoundRoute } from './components/not-found-route';
import { Provider } from './components/ui/provider';
import { Toaster } from './components/ui/toaster';
import { routeTree } from './routeTree.gen';
import 'simplebar-react/dist/simplebar.min.css';
import { IS_SELF_HOSTED } from './utils/self-hosted';
import { getHubUrl } from './utils/url';

const router = createRouter({
  routeTree,
  defaultNotFoundComponent: notFoundRoute,
  defaultErrorComponent: errorRoute,
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

// reloads the app if there is an error fetching an outdated chunk due to a new build deployed
window.addEventListener('vite:preloadError', () => {
  window.location.reload();
});

const isMobile =
  (navigator as any)?.userAgentData?.mobile === true ||
  (matchMedia('(pointer: coarse)').matches && matchMedia('(max-width: 768px)').matches);
if (isMobile) {
  const updateSW = registerSW({
    immediate: true,
    onNeedRefresh() {
      updateSW(true);
    },
  });
} else {
  // Unregister existing service workers on desktop for faster updates
  navigator.serviceWorker
    ?.getRegistrations()
    .then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    })
    .catch((err) => {
      // eslint-disable-next-line no-console
      console.warn('Failed to unregister service workers:', err);
    });
}

// Self hosted instances usually run without a token. Without one the script would still be
// fetched from Vemetric's CDN and then fail, so on those it is only rendered when a token is
// configured. On the hosted instance the token is always present, so this keeps the previous
// unconditional behavior there.
const vemetricToken = import.meta.env.VITE_VEMETRIC_TOKEN || import.meta.env.VEMETRIC_TOKEN;

createRoot(document.getElementById('root')!).render(
  <Provider>
    <ClientProviders>
      {(!IS_SELF_HOSTED || vemetricToken) && (
        <VemetricScript
          host={getHubUrl()}
          token={vemetricToken}
          maskPaths={[
            '/p/*',
            '/p/*/users',
            '/p/*/users/*',
            '/p/*/user/*',
            '/p/*/settings',
            '/p/*/funnels',
            '/p/*/funnels/*',
            '/p/*/events',
            '/o/*',
            '/invite/*',
          ]}
        />
      )}
      <RouterProvider router={router} />
      <Toaster />
    </ClientProviders>
  </Provider>,
);
