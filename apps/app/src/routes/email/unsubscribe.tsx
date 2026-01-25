import { createFileRoute } from '@tanstack/react-router';
import { verifyUnsubscribeToken } from '@vemetric/common/email-token';
import { dbAuthUser } from 'database';
import { logger } from '@/server/utils/logger';

const redirectUrl = 'https://app.vemetric.com/email/unsubscribe';

async function handleUnsubscribe(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return Response.redirect(`${redirectUrl}?error=true`);
  }

  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    logger.warn({ token }, 'Invalid unsubscribe token');
    return Response.redirect(`${redirectUrl}?error=true`);
  }

  try {
    await dbAuthUser.update(userId, { receiveEmailTips: false });
    return Response.redirect(redirectUrl);
  } catch (error) {
    logger.error({ err: error, userId }, 'Failed to unsubscribe user');
    return Response.redirect(`${redirectUrl}?error=true`);
  }
}

export const Route = createFileRoute('/email/unsubscribe')({
  server: {
    handlers: {
      GET: ({ request }) => handleUnsubscribe(request),
    },
  },
});
