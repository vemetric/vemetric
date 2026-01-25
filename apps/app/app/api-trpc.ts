import { eventHandler, toWebRequest } from 'vinxi/http';
import { handleTRPCRequest } from '~/server/trpc/handler';

export default eventHandler(async (event) => {
  const request = toWebRequest(event);
  return handleTRPCRequest(request);
});
