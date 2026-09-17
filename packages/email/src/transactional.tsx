import { render } from '@react-email/render';
import type { ComponentProps } from 'react';
import { sendMail, type MessageStreamId } from './mail-client';
import { getTipsFromAddress, getTransactionalFromAddress } from './mail-config';
import EmailChangeMail from '../emails/email-change';
import EmailVerificationMail from '../emails/email-verification';
import PasswordResetMail from '../emails/password-reset';
import ProjectDeletionMail from '../emails/project-deletion';
import FirstEventFeedback from '../emails/sequences/first-event-feedback/feedback';
import NoEventsFirst from '../emails/sequences/no-events/first';
import NoEventsSecond from '../emails/sequences/no-events/second';
import NoProjectFirst from '../emails/sequences/no-project/first';
import NoProjectSecond from '../emails/sequences/no-project/second';
import SubscriptionCancelledMail from '../emails/subscription-cancelled';
import SubscriptionCreatedMail from '../emails/subscription-created';

export { assertMailConfig, TIPS_FROM_EMAIL, TRANSACTIONAL_FROM_EMAIL } from './mail-config';

export const TRANSACTIONAL_TEMPLATE_MAP = {
  emailVerification: {
    subject: 'Verify your email address',
    email: EmailVerificationMail,
  },
  emailChange: {
    subject: 'Verify your new email address',
    email: EmailChangeMail,
  },
  passwordReset: {
    subject: 'Reset your password',
    email: PasswordResetMail,
  },
  projectDeletion: {
    subject: 'Confirm project deletion',
    email: ProjectDeletionMail,
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
  subscriptionCancelled: {
    subject: 'Thanks for being part of our journey!',
    email: SubscriptionCancelledMail,
  },
  subscriptionCreated: {
    subject: 'Welcome to Vemetric Pro!',
    email: SubscriptionCreatedMail,
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

  const fromAddress = messageStreamId === 'tips' ? getTipsFromAddress() : getTransactionalFromAddress();

  return sendMail({
    from: fromAddress,
    to: toAddress,
    subject: template.subject,
    html: emailHtml,
    text: emailPlainText,
    messageStreamId,
  });
};
