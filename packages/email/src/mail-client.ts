import { getMailProvider } from './mail-config';
import { getPostmarkClient } from './postmark-client';
import { getSmtpTransporter } from './smtp-client';

/** Postmark message stream, only relevant for the Postmark provider. */
export type MessageStreamId = 'outbound' | 'tips';

export interface MailMessage {
  from: string;
  to: string;
  subject: string;
  html: string;
  text: string;
  messageStreamId: MessageStreamId;
}

/**
 * Provider agnostic send result.
 *
 * The shape mirrors the Postmark response fields that callers already log, so switching
 * providers does not change what ends up in the logs.
 */
export interface MailSendResponse {
  MessageID: string;
  SubmittedAt: string;
  ErrorCode: number;
  Message: string;
}

export interface MailSendResult {
  success: boolean;
  response: MailSendResponse;
}

async function sendViaPostmark(message: MailMessage): Promise<MailSendResponse> {
  const { Message } = await import('postmark');
  const postmarkClient = await getPostmarkClient();

  const postmarkMessage = new Message(message.from, message.subject, message.html, message.text, message.to);
  postmarkMessage.MessageStream = message.messageStreamId;

  const response = await postmarkClient.sendEmail(postmarkMessage);

  return {
    MessageID: response.MessageID,
    SubmittedAt: response.SubmittedAt,
    ErrorCode: response.ErrorCode,
    Message: response.Message,
  };
}

async function sendViaSmtp(message: MailMessage): Promise<MailSendResponse> {
  const transporter = await getSmtpTransporter();

  const info = await transporter.sendMail({
    from: message.from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
  });

  const rejected = info.rejected ?? [];
  if (rejected.length > 0) {
    return {
      MessageID: info.messageId ?? '',
      SubmittedAt: new Date().toISOString(),
      ErrorCode: -1,
      Message: 'The SMTP server rejected the recipient.',
    };
  }

  return {
    MessageID: info.messageId ?? '',
    SubmittedAt: new Date().toISOString(),
    ErrorCode: 0,
    Message: 'OK',
  };
}

/**
 * Sends a mail through the configured provider.
 *
 * Never throws: transport failures are reported through the result so that a failing mail
 * does not take down a queue worker or an auth request.
 */
export async function sendMail(message: MailMessage): Promise<MailSendResult> {
  let response: MailSendResponse;

  try {
    response = getMailProvider() === 'smtp' ? await sendViaSmtp(message) : await sendViaPostmark(message);
  } catch (error: any) {
    response = {
      MessageID: '',
      SubmittedAt: new Date().toISOString(),
      ErrorCode: -1,
      Message: error?.message ?? 'Unknown mail transport error.',
    };
  }

  return { success: response.ErrorCode === 0, response };
}
