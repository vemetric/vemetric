import { render } from '@react-email/render';
import { Message } from 'postmark';
import type { MessageSendingResponse } from 'postmark/dist/client/models';
import type { ComponentProps } from 'react';
import * as React from 'react';
import { postmarkClient } from './postmark-client';
import EmailVerificationMail from '../emails/email-verification';
import PasswordResetMail from '../emails/password-reset';

export const TRANSACTIONAL_FROM_EMAIL = 'Vemetric <info@vemetric.com>';

export const TRANSACTIONAL_TEMPLATE_MAP = {
  emailVerification: {
    subject: 'Verify your email address',
    email: EmailVerificationMail,
  },
  passwordReset: {
    subject: 'Reset your password',
    email: PasswordResetMail,
  },
};
type TemplateName = keyof typeof TRANSACTIONAL_TEMPLATE_MAP;

export const sendTransactionalMail = async <T extends TemplateName>(
  toAddress: string,
  templateName: T,
  props: ComponentProps<(typeof TRANSACTIONAL_TEMPLATE_MAP)[T]['email']>,
) => {
  const messageStreamId = process.env.POSTMARK_TRANSACTIONAL_MESSAGE_STREAM_ID;

  const template = TRANSACTIONAL_TEMPLATE_MAP[templateName];
  const Email = template.email;

  const emailHtml = await render(<Email {...(props as any)} />);
  const emailPlainText = await render(<Email {...(props as any)} />, { plainText: true });

  const message = new Message(TRANSACTIONAL_FROM_EMAIL, template.subject, emailHtml, emailPlainText, toAddress);
  message.MessageStream = messageStreamId;

  let response: MessageSendingResponse;
  try {
    response = await postmarkClient.sendEmail(message);
  } catch (error: any) {
    response = {
      MessageID: '',
      SubmittedAt: new Date().toISOString(),
      ErrorCode: -1,
      Message: error.message,
    };
  }

  const success = response.ErrorCode === 0;

  return { success, response };
};
