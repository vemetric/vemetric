import { verifyUnsubscribeToken } from '@vemetric/common/email-token';
import { dbAuthUser } from 'database';
import { logger } from '~/server/utils/logger';

const redirectUrl = 'https://app.vemetric.com/email/unsubscribe';

export async function handleEmailUnsubscribe(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const token = url.searchParams.get('token');

  if (!token) {
    return Response.redirect(`${redirectUrl}?error=true`, 302);
  }

  const userId = verifyUnsubscribeToken(token);
  if (!userId) {
    logger.warn({ token }, 'Invalid unsubscribe token');
    return Response.redirect(`${redirectUrl}?error=true`, 302);
  }

  try {
    await dbAuthUser.update(userId, { receiveEmailTips: false });

    return Response.redirect(redirectUrl, 302);
  } catch (error) {
    logger.error({ err: error, userId }, 'Failed to unsubscribe user');
    return Response.redirect(`${redirectUrl}?error=true`, 302);
  }
}
