import { createTRPCReact } from '@trpc/react-query';
import type { inferRouterOutputs } from '@trpc/server';
import type { AppRouter } from 'backend';

/**
 * Custom tRPC context for client-side operations.
 * Used by splitLink to determine request routing.
 */
export interface TRPCContext {
  /**
   * When true, the request will bypass batching and be sent as a separate HTTP request.
   * Useful for queries that should load in parallel with batched queries.
   */
  skipBatch?: boolean;
}

// Augment tRPC's types to include our custom context
declare module '@trpc/client' {
  interface OperationContext extends TRPCContext {}
}

export const trpc = createTRPCReact<AppRouter>({
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
        await opts.queryClient.invalidateQueries();
      },
    },
  },
});

type RouterOutput = inferRouterOutputs<AppRouter>;

export type DashboardData = RouterOutput['dashboard']['getData'];
export type FunnelData = RouterOutput['funnels']['list']['funnels'][0];
export type SessionData = RouterOutput['users']['events']['sessions'][0];
export type EventData = RouterOutput['users']['events']['events'][0];
