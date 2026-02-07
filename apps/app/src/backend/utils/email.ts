import { createProjectDeletionToken } from '@vemetric/common/email-token';
import { getVemetricUrl } from '@vemetric/common/env';
import { sendTransactionalMail } from '@vemetric/email/transactional';

export async function sendEmailVerificationLink(userEmail: string, url: string, verificationCode?: string) {
  const changeEmail = url.includes('changeEmail');
  const verificationLink = url.replace('callbackURL=/', `callbackURL=${getVemetricUrl('app')}/`);

  if (changeEmail) {
    await sendTransactionalMail(userEmail, {
      template: 'emailChange',
      props: {
        verificationLink,
      },
    });
    return;
  }

  await sendTransactionalMail(userEmail, {
    template: 'emailVerification',
    props: {
      verificationLink,
      verificationCode,
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

export async function sendProjectDeletionConfirmation(
  userEmail: string,
  userName: string,
  projectId: string,
  projectName: string,
  projectDomain: string,
  userId: string,
) {
  const token = createProjectDeletionToken(projectId, userId);
  const confirmationLink = `${getVemetricUrl('app')}/_api/email/confirm-project-deletion?token=${encodeURIComponent(token)}`;

  await sendTransactionalMail(userEmail, {
    template: 'projectDeletion',
    props: {
      userName,
      projectName,
      projectDomain,
      confirmationLink,
    },
  });
}
