import { verifyUnsubscribeToken } from '@vemetric/common/email-token';
import { dbAuthUser } from 'database';
import type { Hono } from 'hono';
import type { HonoContextVars } from '../types';
import { logger } from '../utils/logger';

const redirectUrl = 'https://app.vemetric.com/email/unsubscribe';

export async function useEmailRoutes(app: Hono<{ Variables: HonoContextVars }>) {
  app.get('/email/unsubscribe', async (c) => {
    const token = c.req.query('token');

    if (!token) {
      return c.redirect(`${redirectUrl}?error=true`);
    }

    const userId = verifyUnsubscribeToken(token);
    if (!userId) {
      logger.warn({ token }, 'Invalid unsubscribe token');
      return c.redirect(`${redirectUrl}?error=true`);
    }

    try {
      await dbAuthUser.update(userId, { receiveEmailTips: false });

      return c.redirect(redirectUrl);
    } catch (error) {
      logger.error({ err: error, userId }, 'Failed to unsubscribe user');
      return c.redirect(`${redirectUrl}?error=true`);
    }
  });
}
