import { createTRPCReact } from '@trpc/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { TrpcRouter } from '../../../types';

// Augment tRPC's types to include our custom context
declare module '@trpc/client' {
  interface OperationContext {
    /**
     * When true, the request will bypass batching and be sent as a separate HTTP request.
     * Useful for queries that should load in parallel with batched queries.
     */
    skipBatch?: boolean;
  }
}

export const trpc = createTRPCReact<TrpcRouter>({
  overrides: {
    useMutation: {
      /**
       * This function is called whenever a `.useMutation` succeeds
       **/
      async onSuccess(opts) {
        /**
         * @note that order here matters:
         * The order here allows route changes in `onSuccess` without
         * having a flash of content change whilst redirecting.
         **/
        // Calls the `onSuccess` defined in the `useQuery()`-options:
        await opts.originalFn();
        // Invalidate all queries in the react-query cache:
        opts.queryClient.invalidateQueries();
      },
    },
  },
});

type RouterOutput = inferRouterOutputs<TrpcRouter>;

export type DashboardData = RouterOutput['dashboard']['getData'];
export type FunnelData = RouterOutput['funnels']['list']['funnels'][0];
export type SessionData = RouterOutput['users']['events']['sessions'][0];
export type EventData = RouterOutput['users']['events']['events'][0];
