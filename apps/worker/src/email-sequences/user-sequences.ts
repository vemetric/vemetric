import { sendTransactionalMail } from '@vemetric/email/transactional';
import { dbEmailDripSequence, prismaClient } from 'database';
import { type SequenceContext, type SequenceResult } from './common';

export async function processNoProjectSequence(sequenceContext: SequenceContext): Promise<SequenceResult> {
  const { user, unsubscribeLink, sequence, stepNumber } = sequenceContext;

  const userProjects = await prismaClient.userProject.count({
    where: {
      userId: user.id,
    },
  });

  if (userProjects > 0) {
    // User has created projects, no need to continue the sequence
    await dbEmailDripSequence.completeUserSequence(user.id, sequence.sequenceType);
    return { skipped: true };
  }

  let result: SequenceResult | undefined;

  switch (stepNumber) {
    case 0:
      result = await sendTransactionalMail(
        user.email,
        {
          template: 'noProjectFirst',
          props: {
            userName: user.name,
            unsubscribeLink,
          },
        },
        'tips',
      );
      break;
    case 1:
      result = await sendTransactionalMail(
        user.email,
        {
          template: 'noProjectSecond',
          props: {
            userName: user.name,
            unsubscribeLink,
          },
        },
        'tips',
      );
      break;
    default:
      throw new Error(`Unknown step number: ${stepNumber}`);
  }

  return result;
}
