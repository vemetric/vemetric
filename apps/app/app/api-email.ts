import { createRouter, eventHandler, toWebRequest } from 'vinxi/http';
import { handleEmailUnsubscribe } from '~/server/email/unsubscribe';

const router = createRouter();

router.use(
  '/unsubscribe',
  eventHandler(async (event) => {
    const request = toWebRequest(event);
    return handleEmailUnsubscribe(request);
  })
);

export default router.handler;
