'use client';

import { ChakraProvider } from '@chakra-ui/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getFetch, httpBatchLink, httpLink, splitLink } from '@trpc/client';
import { VemetricScript } from '@vemetric/react';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import superjson from 'superjson';
import { trpc } from '~/utils/trpc';
import { getHubUrl } from '~/utils/url';
import { vemetricTheme } from '~/style/theme';
import { ColorModeProvider } from '~/components/ui/color-mode';
import { Toaster } from '~/components/ui/toaster';

export function AppProviders({ children }: PropsWithChildren) {
  const [queryClient] = useState(() => {
    return new QueryClient({
      defaultOptions: {
        queries: {
          staleTime: 5000,
          retry: (failureCount, error: any) => {
            if (error.data?.httpStatus === 403) {
              return false;
            }
            return failureCount < 3;
          },
        },
      },
    });
  });

  // tRPC URL is now relative since we're on the same origin
  const url = '/trpc';

  const fetchOptions = {
    fetch: async (input: RequestInfo | URL, init?: RequestInit) => {
      const fetch = getFetch();
      return fetch(input, {
        ...init,
        credentials: 'include',
      });
    },
  };

  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson,
      links: [
        splitLink({
          // Check for skipBatch flag in context to send as separate request
          condition: (op) => op.context.skipBatch === true,
          true: httpLink({ url, ...fetchOptions }),
          false: httpBatchLink({ url, ...fetchOptions }),
        }),
      ],
    }),
  );

  return (
    <ChakraProvider value={vemetricTheme}>
      <ColorModeProvider>
        <trpc.Provider client={trpcClient} queryClient={queryClient}>
          <QueryClientProvider client={queryClient}>
            <VemetricScript
              host={getHubUrl()}
              token={import.meta.env.VITE_VEMETRIC_TOKEN || import.meta.env.VEMETRIC_TOKEN}
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
            {children}
            <Toaster />
          </QueryClientProvider>
        </trpc.Provider>
      </ColorModeProvider>
    </ChakraProvider>
  );
}
