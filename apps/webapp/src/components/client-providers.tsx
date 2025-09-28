import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { getFetch, httpBatchLink } from '@trpc/client';
import type { PropsWithChildren } from 'react';
import { useState } from 'react';
import superjson from 'superjson';
import { trpc } from '@/utils/trpc';
import { getBackendUrl } from '@/utils/url';

export const ClientProviders = ({ children }: PropsWithChildren) => {
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

  const url = getBackendUrl() + '/trpc';

  const [trpcClient] = useState(() =>
    trpc.createClient({
      transformer: superjson,
      links: [
        httpBatchLink({
          url,
          fetch: async (input, init?) => {
            const fetch = getFetch();
            return fetch(input, {
              ...init,
              credentials: 'include',
            });
          },
        }),
      ],
    }),
  );

  return (
    <trpc.Provider client={trpcClient} queryClient={queryClient}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </trpc.Provider>
  );
};
