import { render } from '@react-email/render';
import type { ComponentProps } from 'react';
import { sendCloudflareEmail, type EmailSendingSendParams } from './cloudflare-email-client';
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

export const TRANSACTIONAL_FROM_EMAIL = {
  name: 'Vemetric',
  address: 'info@vemetric.com',
} satisfies EmailSendingSendParams['from'];
export const TIPS_FROM_EMAIL = {
  name: 'Vemetric',
  address: 'info@notifications.vemetric.com',
} satisfies EmailSendingSendParams['from'];

type MessageStreamId = 'outbound' | 'tips';

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

  let fromAddress: EmailSendingSendParams['from'] = TRANSACTIONAL_FROM_EMAIL;
  if (messageStreamId === 'tips') {
    fromAddress = TIPS_FROM_EMAIL;
  }

  try {
    const cloudflareResponse = await sendCloudflareEmail({
      to: toAddress,
      from: fromAddress,
      subject: template.subject,
      html: emailHtml,
      text: emailPlainText,
    });

    const failedRecipients = cloudflareResponse.permanent_bounces;
    const success = failedRecipients.length === 0;
    const providerMessage = success
      ? `Email accepted by Cloudflare Email Service (${messageStreamId})`
      : failedRecipients.join(', ') || 'Cloudflare Email Service failed to send email.';

    return {
      success,
      response: {
        SubmittedAt: new Date().toISOString(),
        ErrorCode: success ? 0 : -1,
        Message: providerMessage,
      },
    };
  } catch (error: any) {
    return {
      success: false,
      response: {
        SubmittedAt: new Date().toISOString(),
        ErrorCode: -1,
        Message: error.message,
      },
    };
  }
};
