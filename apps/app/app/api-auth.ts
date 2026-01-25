import { eventHandler, toWebRequest } from 'vinxi/http';
import { auth } from '~/server/auth';

export default eventHandler(async (event) => {
  const request = toWebRequest(event);
  return auth.handler(request);
});
