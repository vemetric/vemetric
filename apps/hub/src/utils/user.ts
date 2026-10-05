import { formatClickhouseDate } from '@vemetric/common/date';
import { createUserQueue } from '@vemetric/queues/create-user-queue';
import { enrichUserQueue } from '@vemetric/queues/enrich-user-queue';
import { mergeUserJobOptions, mergeUserQueue } from '@vemetric/queues/merge-user-queue';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { updateUserDataModel, updateUserQueue } from '@vemetric/queues/update-user-queue';
import { generateUserId, dbUserIdentificationMap } from 'database';
import { z } from 'zod';
import { setUserIdCookie } from './cookie';
import { logger } from './logger';
import { continueSession } from './session';
import type { HonoContext } from '../types';

const enableLogs = false;
const logInfo = (params: Record<string, unknown>, msg: string) => {
  if (!enableLogs) {
    return;
  }
  logger.info(params, msg);
};

// The merge runs this long after the identification, and the anonymous id's activity up to the
// same point belongs to the identified user (requests that were already on their way).
const MERGE_DELAY_MS = 6000;

export const identifySchema = z.object({
  identifier: z.string().min(1),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
  data: updateUserDataModel.optional(),
});
export type IdentifySchema = z.infer<typeof identifySchema>;

// Queues the merge of an anonymous id into the identified user. Without an active session of its
// own, the user continues the visit that led to the login.
async function mergeIntoUser(
  projectId: bigint,
  anonymousUserId: bigint,
  identifiedUserId: bigint,
  displayName?: string,
) {
  const fiveSecondRoundedDate = new Date();
  fiveSecondRoundedDate.setMilliseconds(0);
  fiveSecondRoundedDate.setSeconds(fiveSecondRoundedDate.getSeconds() - (fiveSecondRoundedDate.getSeconds() % 5));
  const oldUserId = String(anonymousUserId);

  await continueSession(projectId, anonymousUserId, identifiedUserId);
  await addToQueue(
    mergeUserQueue,
    {
      projectId: String(projectId),
      oldUserId,
      newUserId: String(identifiedUserId),
      displayName,
      cutoff: formatClickhouseDate(new Date(Date.now() + MERGE_DELAY_MS)),
    },
    {
      ...mergeUserJobOptions,
      jobId: `${String(projectId)}-${oldUserId}-${String(identifiedUserId)}-${fiveSecondRoundedDate.toISOString()}`,
      delay: MERGE_DELAY_MS,
    },
  );
}

/**
 * Identifies the visitor. `userId` is the id the visitor's earlier requests used, or null when
 * there are none (e.g. a backend request). `activeHashedUserId` is the visitor's hashed id when
 * it differs from `userId` and was active in the last 30 minutes: requests that did not allow
 * cookies used it, e.g. the start of a return visit when cookies are allowed only for identify.
 * Returns the identified user's id.
 */
export async function identifyUser(
  context: HonoContext,
  body: IdentifySchema,
  projectId: bigint,
  userId: bigint | null,
  activeHashedUserId: bigint | null = null,
): Promise<bigint> {
  const { allowCookies, geoData } = context.var;

  const { identifier, displayName, avatarUrl } = body;
  logInfo({ projectId: String(projectId), userId: String(userId), identifier, avatarUrl }, 'start identifying user');

  const { set, setOnce } = body.data ?? {};
  const now = formatClickhouseDate(new Date());
  let anonymousUserId = userId;
  // The hashed id is merged too, unless it belongs to an identified user itself.
  const hashedUserId =
    activeHashedUserId !== null &&
    activeHashedUserId !== userId &&
    !(await dbUserIdentificationMap.findByUserId(String(projectId), String(activeHashedUserId)))
      ? activeHashedUserId
      : null;

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
      if (hashedUserId !== null) {
        await mergeIntoUser(projectId, hashedUserId, userId, displayName);
      }

      return userId;
    }

    if (existingUserWithId) {
      logInfo(
        {
          projectId: String(projectId),
          userId: String(userId),
          identifier,
          existingIdentifier: existingUserWithId?.identifier,
        },
        'user already identified, but with different identifier',
      );
      // The id belongs to another identified user, which keeps its activity.
      anonymousUserId = null;
    }
  }

  let identifiedUserId: bigint;
  const existingUserWithIdentifer = await dbUserIdentificationMap.findByIdentifier(String(projectId), identifier);
  if (!existingUserWithIdentifer) {
    logInfo(
      { projectId: String(projectId), userId: String(userId), identifier },
      'user identified for the first time, create the user',
    );
    // An identified user always gets a new id. The anonymous id (for cookieless tracking a hash of
    // IP address and browser that other visitors can share for the rest of the day) is merged into it.
    identifiedUserId = generateUserId();
    try {
      await dbUserIdentificationMap.create(String(projectId), String(identifiedUserId), identifier);
    } catch (err) {
      logger.error(
        { projectId: String(projectId), userId: String(identifiedUserId), identifier, err },
        'Error creating user identification map entry',
      );
      throw err;
    }

    await addToQueue(
      createUserQueue,
      {
        projectId: String(projectId),
        userId: String(identifiedUserId),
        createdAt: now,
        geoData,
        identifier,
        displayName: displayName ?? '',
        avatarUrl: avatarUrl || '',
        data: { ...set, ...setOnce },
      },
      {
        jobId: `${String(projectId)}-${String(identifiedUserId)}`,
      },
    );
  } else {
    identifiedUserId = BigInt(existingUserWithIdentifer.userId);
    logInfo(
      { projectId: String(projectId), userId: String(userId), newUserId: String(identifiedUserId), identifier },
      'user was already identified, try to merge',
    );

    await addToQueue(updateUserQueue, {
      projectId: String(projectId),
      userId: String(identifiedUserId),
      updatedAt: now,
      displayName,
      avatarUrl,
      data: body.data,
    });
  }

  for (const anonymousId of Array.from(new Set([anonymousUserId, hashedUserId]))) {
    if (anonymousId !== null && anonymousId !== identifiedUserId) {
      await mergeIntoUser(projectId, anonymousId, identifiedUserId, displayName);
    }
  }

  const fiveSecondRoundedDate = new Date();
  fiveSecondRoundedDate.setMilliseconds(0);
  fiveSecondRoundedDate.setSeconds(fiveSecondRoundedDate.getSeconds() - (fiveSecondRoundedDate.getSeconds() % 5));

  if (existingUserWithIdentifer) {
    // Queue enrichment for the existing user to backfill attribution data if needed
    await addToQueue(
      enrichUserQueue,
      {
        projectId: String(projectId),
        userId: String(identifiedUserId),
      },
      {
        jobId: `${String(projectId)}-${String(identifiedUserId)}-${fiveSecondRoundedDate.toISOString()}`,
        delay: 10000, // Delay to ensure user is created/updated first
      },
    );
  }

  if (allowCookies) {
    setUserIdCookie(context, identifiedUserId);
  }

  return identifiedUserId;
}
