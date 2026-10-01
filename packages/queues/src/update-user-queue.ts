import { z } from 'zod';
import { updateUserQueueName } from './queue-names';
import { createQueue } from './queue-utils';

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
  avatarUrl?: string;
  data?: UpdateUserDataModel;
}

export const updateUserQueue = createQueue<UpdateUserQueueProps>(updateUserQueueName);
updateUserQueue.setGlobalConcurrency(1);
