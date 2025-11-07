import { formatClickhouseDate } from '@vemetric/common/date';
import { createUserQueue } from '@vemetric/queues/create-user-queue';
import { enrichUserQueue } from '@vemetric/queues/enrich-user-queue';
import { mergeUserQueue } from '@vemetric/queues/merge-user-queue';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { updateUserDataModel, updateUserQueue } from '@vemetric/queues/update-user-queue';
import { generateUserId, dbUserIdentificationMap } from 'database';
import { z } from 'zod';
import { setUserIdCookie } from './cookie';
import { logger } from './logger';
import type { HonoContext } from '../types';

const enableLogs = false;
const logInfo = (params: Record<string, unknown>, msg: string) => {
  if (!enableLogs) {
    return;
  }
  logger.info(params, msg);
};

export const REDIS_USER_IDENTIFY_EXPIRATION = 60; // seconds
// used to make sure identification of a user is not done multiple at the same time
export function getRedisUserIdentifyKey(projectId: bigint, identifier: string) {
  return `identification:${projectId}:${identifier}`;
}

export const identifySchema = z.object({
  identifier: z.string().min(1),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  data: updateUserDataModel.optional(),
});
export type IdentifySchema = z.infer<typeof identifySchema>;

export async function identifyUser(
  context: HonoContext,
  body: IdentifySchema,
  projectId: bigint,
  userId: bigint | null,
) {
  const { allowCookies, ipAddress } = context.var;

  const { identifier, displayName, avatarUrl } = body;
  logInfo({ projectId: String(projectId), userId: String(userId), identifier, avatarUrl }, 'start identifying user');

  const { set, setOnce } = body.data ?? {};
  const now = formatClickhouseDate(new Date());

  if (userId !== null) {
    const existingUserWithId = await dbUserIdentificationMap.findByUserId(String(projectId), String(userId));

    if (existingUserWithId && existingUserWithId.identifier === identifier) {
      logInfo(
        { projectId: String(projectId), userId: String(userId), identifier },
        'user already identified, updating user',
      );
      await addToQueue(updateUserQueue, {
        projectId: String(projectId),
        userId: String(userId),
        updatedAt: now,
        displayName,
        avatarUrl,
        data: body.data,
      });

      return context.text('', 200);
    }

    if (existingUserWithId && existingUserWithId?.identifier !== identifier) {
      logInfo(
        {
          projectId: String(projectId),
          userId: String(userId),
          identifier,
          existingIdentifier: existingUserWithId?.identifier,
        },
        'user already identified, but with different identifier',
      );
      // we have a user with the same id but different identifier, so we generate a new id before executing the merge logic (leave the old user as it is)
      userId = null;
    }
  }

  const existingUserWithIdentifer = await dbUserIdentificationMap.findByIdentifier(String(projectId), identifier);
  if (!existingUserWithIdentifer) {
    logInfo(
      { projectId: String(projectId), userId: String(userId), identifier },
      'user identified for the first time, create the user',
    );
    // the user has been identified for the first time .. no need to merge, we'll just assign all the past events directly to him
    if (userId === null) {
      userId = generateUserId();
    }
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
        avatarUrl: avatarUrl || '',
        data: { ...set, ...setOnce },
      },
      {
        jobId: `${String(projectId)}:${String(userId)}`,
      },
    );
  } else {
    const newUserId = BigInt(existingUserWithIdentifer.userId);
    logInfo(
      { projectId: String(projectId), userId: String(userId), newUserId: String(newUserId), identifier },
      'user was already identified, try to merge',
    );

    await addToQueue(updateUserQueue, {
      projectId: String(projectId),
      userId: String(newUserId),
      updatedAt: now,
      displayName,
      avatarUrl,
      data: body.data,
    });

    const fiveSecondRoundedDate = new Date();
    fiveSecondRoundedDate.setMilliseconds(0);
    fiveSecondRoundedDate.setSeconds(fiveSecondRoundedDate.getSeconds() - (fiveSecondRoundedDate.getSeconds() % 5));

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
          jobId: `${String(projectId)}:${oldUserId}:${String(newUserId)}:${fiveSecondRoundedDate.toISOString()}`,
          delay: 6000,
        },
      );
    }

    // Queue enrichment for the existing user to backfill attribution data if needed
    await addToQueue(
      enrichUserQueue,
      {
        projectId: String(projectId),
        userId: String(newUserId),
      },
      {
        jobId: `${String(projectId)}:${String(newUserId)}:${fiveSecondRoundedDate.toISOString()}`,
        delay: 10000, // Delay to ensure user is created/updated first
      },
    );

    // we set the cookie to the id of the existing user
    userId = newUserId;
  }

  if (allowCookies) {
    setUserIdCookie(context, userId);
  }

  return context.text('', 200);
}
