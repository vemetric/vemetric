import { render } from '@react-email/render';
import { Message } from 'postmark';
import type { MessageSendingResponse } from 'postmark/dist/client/models';
import type { ComponentProps } from 'react';
import { postmarkClient } from './postmark-client';
import EmailVerificationMail from '../emails/email-verification';
import PasswordResetMail from '../emails/password-reset';
import FirstEventFeedback from '../emails/sequences/first-event-feedback/feedback';
import NoEventsFirst from '../emails/sequences/no-events/first';
import NoEventsSecond from '../emails/sequences/no-events/second';
import NoProjectFirst from '../emails/sequences/no-project/first';
import NoProjectSecond from '../emails/sequences/no-project/second';

export const TRANSACTIONAL_FROM_EMAIL = 'Vemetric <info@vemetric.com>';
export const TIPS_FROM_EMAIL = 'Vemetric <info@notifications.vemetric.com>';

type MessageStreamId = 'outbound' | 'tips';

export const TRANSACTIONAL_TEMPLATE_MAP = {
  emailVerification: {
    subject: 'Verify your email address',
    email: EmailVerificationMail,
  },
  passwordReset: {
    subject: 'Reset your password',
    email: PasswordResetMail,
  },
  noEventsFirst: {
    subject: 'Need help getting started?',
    email: NoEventsFirst,
  },
  noEventsSecond: {
    subject: "Let's setup Vemetric together",
    email: NoEventsSecond,
  },
  noProjectFirst: {
    subject: 'Ready to start understanding your users?',
    email: NoProjectFirst,
  },
  noProjectSecond: {
    subject: "Let's setup Vemetric together",
    email: NoProjectSecond,
  },
  firstEventFeedback: {
    subject: "How's your experience with Vemetric so far?",
    email: FirstEventFeedback,
  },
};
export type TemplateName = keyof typeof TRANSACTIONAL_TEMPLATE_MAP;

export type TemplateData<T extends TemplateName> = {
  template: T;
  props: ComponentProps<(typeof TRANSACTIONAL_TEMPLATE_MAP)[T]['email']>;
};

export const sendTransactionalMail = async <T extends TemplateName>(
  toAddress: string,
  templateData: TemplateData<T>,
  messageStreamId: MessageStreamId = 'outbound',
) => {
  const template = TRANSACTIONAL_TEMPLATE_MAP[templateData.template];
  const templateProps = templateData.props;
  const Email = template.email;

  const emailHtml = await render(<Email {...(templateProps as any)} />);
  const emailPlainText = await render(<Email {...(templateProps as any)} />, { plainText: true });

  let fromAddress = TRANSACTIONAL_FROM_EMAIL;
  if (messageStreamId === 'tips') {
    fromAddress = TIPS_FROM_EMAIL;
  }

  const message = new Message(fromAddress, template.subject, emailHtml, emailPlainText, toAddress);
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
