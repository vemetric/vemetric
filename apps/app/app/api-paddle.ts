import { eventHandler, toWebRequest } from 'vinxi/http';
import { handlePaddleWebhook } from '~/server/paddle/webhook';

export default eventHandler(async (event) => {
  const request = toWebRequest(event);
  return handlePaddleWebhook(request);
});
