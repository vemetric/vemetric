import { formatClickhouseDate } from '@vemetric/common/date';
import { getClientIp } from '@vemetric/common/request-ip';
import { createUserQueue } from '@vemetric/queues/create-user-queue';
import { mergeUserQueue } from '@vemetric/queues/merge-user-queue';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { updateUserDataModel, updateUserQueue } from '@vemetric/queues/update-user-queue';
import { generateUserId, dbUserIdentificationMap } from 'database';
import type { Context } from 'hono';
import { z } from 'zod';
import { setUserIdCookie } from './cookie';
import { getUserIdFromRequest } from './request';

export const REDIS_USER_IDENTIFY_EXPIRATION = 60; // seconds
// used to make sure identification of a user is not done multiple at the same time
export function getRedisUserIdentifyKey(projectId: bigint, identifier: string) {
  return `identification:${projectId}:${identifier}`;
}

export const identifySchema = z.object({
  identifier: z.string().min(1),
  displayName: z.string().optional(),
  data: updateUserDataModel.optional(),
});
export type IdentifySchema = z.infer<typeof identifySchema>;

export async function identifyUser(context: Context, body: IdentifySchema, projectId: bigint) {
  const { allowCookies } = context.var;

  let userId = await getUserIdFromRequest(context, false);
  const { identifier, displayName } = body;

  const { set, setOnce } = body.data ?? {};
  const now = formatClickhouseDate(new Date());

  if (userId !== null) {
    const existingUserWithId = await dbUserIdentificationMap.findByUserId(String(projectId), String(userId));

    if (existingUserWithId && existingUserWithId.identifier === identifier) {
      await addToQueue(updateUserQueue, {
        projectId: String(projectId),
        userId: String(userId),
        updatedAt: now,
        displayName,
        data: body.data,
      });

      return context.text('', 200);
    }

    if (existingUserWithId && existingUserWithId?.identifier !== identifier) {
      // we have a user with the same id but different identifier, so we generate a new id before executing the merge logic (leave the old user as it is)
      userId = null;
    }
  }

  const existingUserWithIdentifer = await dbUserIdentificationMap.findByIdentifier(String(projectId), identifier);
  if (!existingUserWithIdentifer) {
    // the user has been identified for the first time .. no need to merge, we'll just assign all the past events directly to him
    if (userId === null) {
      userId = generateUserId();
    }
    const ipAddress = getClientIp(context) ?? '';
    await dbUserIdentificationMap.create(String(projectId), String(userId), identifier);

    await addToQueue(
      createUserQueue,
      {
        projectId: String(projectId),
        userId: String(userId),
        createdAt: now,
        ipAddress,
        identifier,
        displayName: displayName ?? '',
        data: { ...set, ...setOnce },
      },
      {
        jobId: String(userId),
      },
    );
  } else {
    const newUserId = BigInt(existingUserWithIdentifer.userId);

    await addToQueue(updateUserQueue, {
      projectId: String(projectId),
      userId: String(newUserId),
      updatedAt: now,
      displayName,
      data: body.data,
    });

    if (userId !== null) {
      const oldUserId = String(userId);

      await addToQueue(
        mergeUserQueue,
        {
          projectId: String(projectId),
          oldUserId,
          newUserId: String(newUserId),
          displayName,
        },
        {
          jobId: `${oldUserId}:${String(newUserId)}`,
          delay: 5000,
        },
      );
    }

    // we set the cookie to the id of the existing user
    userId = newUserId;
  }

  if (allowCookies) {
    setUserIdCookie(context, userId);
  }

  return context.text('', 200);
}
