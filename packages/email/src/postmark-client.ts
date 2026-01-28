import type { ServerClient } from 'postmark';

let cachedClient: ServerClient | null = null;

export async function getPostmarkClient(): Promise<ServerClient> {
  if (!process.env.POSTMARK_SERVER_API_TOKEN) {
    throw new Error('Postmark Server API Token is not specified.');
  }

  if (cachedClient) {
    return cachedClient;
  }

  const postmark = await import('postmark');
  cachedClient = new postmark.ServerClient(process.env.POSTMARK_SERVER_API_TOKEN);
  return cachedClient;
}
