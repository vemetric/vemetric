import { createAPIFileRoute } from '@tanstack/react-start/api';
import { handleTRPCRequest } from '~/server/trpc/handler';

export const APIRoute = createAPIFileRoute('/trpc/$')({
  GET: ({ request }) => handleTRPCRequest(request),
  POST: ({ request }) => handleTRPCRequest(request),
});
