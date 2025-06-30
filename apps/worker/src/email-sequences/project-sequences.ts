import { sendTransactionalMail, TIPS_FROM_EMAIL } from '@vemetric/email/transactional';
import { clickhouseEvent } from 'clickhouse';
import { dbEmailDripSequence } from 'database';
import { type SequenceContext, type SequenceResult } from './common';

export async function processNoEventsSequence(sequenceContext: SequenceContext): Promise<SequenceResult> {
  const { project, user, unsubscribeLink, sequence, stepNumber } = sequenceContext;
  if (!project) {
    throw new Error('Project is required in project email sequences');
  }

  const hasEvents = (await clickhouseEvent.getAllEventsCount(BigInt(project.id))) > 0;

  if (hasEvents) {
    // we don't need to continue the sequence as the project has events
    await dbEmailDripSequence.completeProjectSequence(project.id, sequence.sequenceType);
    return { skipped: true };
  }

  let result: SequenceResult | undefined;

  switch (stepNumber) {
    case 0:
      result = await sendTransactionalMail(
        user.email,
        {
          template: 'noEventsFirst',
          props: {
            userName: user.name,
            projectId: project.id,
            projectName: project.name,
            unsubscribeLink,
          },
        },
        TIPS_FROM_EMAIL,
      );
      break;
    case 1:
      result = await sendTransactionalMail(
        user.email,
        {
          template: 'noEventsSecond',
          props: {
            userName: user.name,
            projectId: project.id,
            projectName: project.name,
            unsubscribeLink,
          },
        },
        TIPS_FROM_EMAIL,
      );
      break;
    default:
      throw new Error(`Unknown step number: ${stepNumber}`);
  }

  return result;
}
