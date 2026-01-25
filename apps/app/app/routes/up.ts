import { createAPIFileRoute } from '@tanstack/react-start/api';

export const APIRoute = createAPIFileRoute('/up')({
  GET: () => new Response('', { status: 200 }),
});
