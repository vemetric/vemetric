import { sendTransactionalMail } from '@vemetric/email/transactional';
import { DOMAIN } from '../consts';

export async function sendEmailVerificationLink(userEmail: string, url: string) {
  await sendTransactionalMail(userEmail, 'emailVerification', {
    verificationLink: url.replace('callbackURL=/', 'callbackURL=https://app.' + DOMAIN + '/'),
  });
}

export async function sendPasswordResetLink(userEmail: string, userFirstName: string, url: string) {
  await sendTransactionalMail(userEmail, 'passwordReset', {
    firstName: userFirstName,
    resetLink: url,
  });
}
