import { createFileRoute } from '@tanstack/react-router';

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: () =>
        new Response(JSON.stringify({ error: 'Not implemented' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
      POST: () =>
        new Response(JSON.stringify({ error: 'Not implemented' }), {
          status: 404,
          headers: { 'Content-Type': 'application/json' },
        }),
    },
  },
});
