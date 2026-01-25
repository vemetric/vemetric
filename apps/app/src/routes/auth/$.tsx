import { createFileRoute } from '@tanstack/react-router';
import { auth } from '@/server/auth';

export const Route = createFileRoute('/auth/$')({
  server: {
    handlers: {
      GET: ({ request }) => auth.handler(request),
      POST: ({ request }) => auth.handler(request),
    },
  },
});
