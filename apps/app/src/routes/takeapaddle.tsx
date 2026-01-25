import { createFileRoute } from '@tanstack/react-router';
import { handlePaddleWebhook } from '@/server/api/paddle';

export const Route = createFileRoute('/takeapaddle')({
  server: {
    handlers: {
      POST: ({ request }) => handlePaddleWebhook(request),
    },
  },
});
