import { createAPIFileRoute } from '@tanstack/react-start/api';
import { handleEmailUnsubscribe } from '~/server/email/unsubscribe';

export const APIRoute = createAPIFileRoute('/api/email/unsubscribe')({
  GET: async ({ request }) => {
    return handleEmailUnsubscribe(request);
  },
  POST: async ({ request }) => {
    return handleEmailUnsubscribe(request);
  },
});
