import { createAPIFileRoute } from '@tanstack/react-start/api';

export const APIRoute = createAPIFileRoute('/up')({
  GET: async () => {
    return new Response('', { status: 200 });
  },
});
