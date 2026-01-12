import { sendTransactionalMail } from '@vemetric/email/transactional';
import { clickhouseEvent } from 'clickhouse';
import { dbEmailDripSequence, dbOrganization } from 'database';
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

  // Check if the user has any OTHER project with events already
  // If so, they already know how to integrate and don't need onboarding emails
  const userOrgs = await dbOrganization.getUserOrganizationsWithProjects(user.id);
  const allUserProjects = userOrgs.flatMap(({ organization }) => organization.project);
  const otherProjects = allUserProjects.filter((p) => p.id !== project.id);

  for (const otherProject of otherProjects) {
    const otherProjectHasEvents = (await clickhouseEvent.getAllEventsCount(BigInt(otherProject.id))) > 0;
    if (otherProjectHasEvents) {
      // User already has another project with events, they know how to onboard
      await dbEmailDripSequence.completeProjectSequence(project.id, sequence.sequenceType);
      return { skipped: true };
    }
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
        'tips',
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
        'tips',
      );
      break;
    default:
      throw new Error(`Unknown step number: ${stepNumber}`);
  }

  return result;
}
