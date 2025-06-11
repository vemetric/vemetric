import * as postmark from 'postmark';

if (!process.env.POSTMARK_SERVER_API_TOKEN) {
  throw new Error('Postmark Server API Token is not specified.');
}
if (!process.env.POSTMARK_TRANSACTIONAL_MESSAGE_STREAM_ID) {
  throw new Error('Postmark Transactional Message Stream ID is not specified.');
}

export const postmarkClient = new postmark.ServerClient(process.env.POSTMARK_SERVER_API_TOKEN);
