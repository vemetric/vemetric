import { getVemetricUrl } from '@vemetric/common/env';
import { sendTransactionalMail } from '@vemetric/email/transactional';

export async function sendEmailVerificationLink(userEmail: string, url: string) {
  await sendTransactionalMail(userEmail, {
    template: 'emailVerification',
    props: {
      verificationLink: url.replace('callbackURL=/', `callbackURL=${getVemetricUrl('app')}/`),
    },
  });
}

export async function sendPasswordResetLink(userEmail: string, userFirstName: string, url: string) {
  await sendTransactionalMail(userEmail, {
    template: 'passwordReset',
    props: {
      firstName: userFirstName,
      resetLink: url,
    },
  });
}
