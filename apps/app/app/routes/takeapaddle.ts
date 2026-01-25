import { createAPIFileRoute } from '@tanstack/react-start/api';
import { handlePaddleWebhook } from '~/server/paddle/webhook';

export const APIRoute = createAPIFileRoute('/takeapaddle')({
  POST: async ({ request }) => {
    return handlePaddleWebhook(request);
  },
});
