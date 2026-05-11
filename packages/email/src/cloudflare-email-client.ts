import Cloudflare from 'cloudflare';
import type {
  EmailSendingSendParams,
  EmailSendingSendResponse,
} from 'cloudflare/resources/email-sending/email-sending';

export type {
  EmailSendingSendParams,
  EmailSendingSendResponse,
} from 'cloudflare/resources/email-sending/email-sending';

let cachedClient: Cloudflare | null = null;

function getCloudflareClient(): Cloudflare {
  const apiToken = process.env.CLOUDFLARE_EMAIL_API_TOKEN;
  if (!apiToken) {
    throw new Error('Cloudflare Email API Token is not specified.');
  }

  if (cachedClient) {
    return cachedClient;
  }

  cachedClient = new Cloudflare({ apiToken });
  return cachedClient;
}

export async function sendCloudflareEmail(
  request: Omit<EmailSendingSendParams, 'account_id'>,
): Promise<EmailSendingSendResponse> {
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID;
  if (!accountId) {
    throw new Error('Cloudflare Account ID is not specified.');
  }

  return getCloudflareClient().emailSending.send({
    account_id: accountId,
    ...request,
  });
}
