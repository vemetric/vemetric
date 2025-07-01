import * as postmark from 'postmark';

if (!process.env.POSTMARK_SERVER_API_TOKEN) {
  throw new Error('Postmark Server API Token is not specified.');
}

export const postmarkClient = new postmark.ServerClient(process.env.POSTMARK_SERVER_API_TOKEN);
