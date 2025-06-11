import { Queue } from 'bullmq';
import { z } from 'zod';
import { updateUserQueueName } from './queue-names';
import { defaultQueueConnection } from './queue-utils';

export const updateUserDataModel = z.object({
  set: z.record(z.string(), z.any()).optional(),
  setOnce: z.record(z.string(), z.any()).optional(),
  unset: z.array(z.string()).optional(),
});
export type UpdateUserDataModel = z.infer<typeof updateUserDataModel>;

export interface UpdateUserQueueProps {
  projectId: string;
  userId: string;
  updatedAt: string;
  displayName?: string;
  data?: UpdateUserDataModel;
}

export const updateUserQueue = new Queue<UpdateUserQueueProps>(updateUserQueueName, {
  connection: defaultQueueConnection,
});
updateUserQueue.setGlobalConcurrency(1);
