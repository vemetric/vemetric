import { Queue } from 'bullmq';
import type { DripSequenceType } from 'database';
import { emailDripQueueName } from './queue-names';
import { defaultQueueConnection } from './queue-utils';

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

export const emailDripQueue = new Queue<EmailDripQueueProps>(emailDripQueueName, {
  connection: defaultQueueConnection,
});
