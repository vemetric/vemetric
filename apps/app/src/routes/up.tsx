import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/up')({
  server: {
    handlers: {
      GET: () => new Response('', { status: 200 }),
    },
  },
});
