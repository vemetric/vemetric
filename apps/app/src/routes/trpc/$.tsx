import { createFileRoute } from '@tanstack/react-router';
import { handleTRPCRequest } from '@/server/trpc';

export const Route = createFileRoute('/trpc/$')({
  server: {
    handlers: {
      GET: ({ request }) => handleTRPCRequest(request),
      POST: ({ request }) => handleTRPCRequest(request),
    },
  },
});
