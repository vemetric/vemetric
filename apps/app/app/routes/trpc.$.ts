import { createAPIFileRoute } from '@tanstack/react-start/api';
import { handleTRPCRequest } from '~/server/trpc/handler';

export const APIRoute = createAPIFileRoute('/trpc/$')({
  GET: async ({ request }) => {
    return handleTRPCRequest(request);
  },
  POST: async ({ request }) => {
    return handleTRPCRequest(request);
  },
});
