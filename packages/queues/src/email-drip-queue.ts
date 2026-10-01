import type { DripSequenceType } from 'database';
import { emailDripQueueName } from './queue-names';
import { createQueue } from './queue-utils';

type BaseProps = {
  sequenceType: DripSequenceType;
  stepNumber: number;
};

export type EmailDripQueueProps = BaseProps &
  (
    | {
        projectId: string;
      }
    | {
        userId: string;
      }
  );

export const emailDripQueue = createQueue<EmailDripQueueProps>(emailDripQueueName);
