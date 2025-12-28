import type { UserIdentificationMap } from 'database';
import { dbSalt, dbUserIdentificationMap, generateUserId } from 'database';
import type { HonoRequest } from 'hono';
import { getUserIdFromCookie } from './cookie';
import type { HonoContext } from '../types';
import { logger } from './logger';
import { getUserIdentificationLock, releaseUserIdentificationLock } from './redis';
import { hasActiveSession } from './session';
import { identifyUser } from './user';

const IDENTIFICATION_POLL_INTERVAL_MS = 100;
const IDENTIFICATION_MAX_WAIT_MS = 5000;

/**
 * Waits for a user identification to be created by another concurrent request.
 * Polls the database until the user is found or timeout is reached.
 */
async function waitForUserIdentification(projectId: string, identifier: string): Promise<UserIdentificationMap | null> {
  const startTime = Date.now();

  while (Date.now() - startTime < IDENTIFICATION_MAX_WAIT_MS) {
    const user = await dbUserIdentificationMap.findByIdentifier(projectId, identifier);
    if (user) {
      return user;
    }
    await new Promise((resolve) => setTimeout(resolve, IDENTIFICATION_POLL_INTERVAL_MS));
  }

  return null;
}

export function isPrefetchRequest(req: HonoRequest) {
  const xPurpose = req.header('X-Purpose');
  const purpose = req.header('Purpose');
  const xMoz = req.header('X-Moz');

  return (
    xMoz == 'prefetch' ||
    xPurpose == 'prefetch' ||
    xPurpose == 'preview' ||
    purpose == 'prefetch' ||
    purpose == 'preview'
  );
}

export async function getUserIdFromRequest(context: HonoContext, useBodyIdentifier = true) {
  const { req } = context;
  const { projectId, allowCookies, ipAddress } = context.var;

  try {
    const userId = getUserIdFromCookie(context);
    if (userId) {
      return userId;
    }

    const bodyData = await req.json();

    let user: UserIdentificationMap | null = null;
    const userIdentifier = bodyData.userIdentifier;

    if (typeof userIdentifier === 'string') {
      // this is the case for the API call, e.g. via the NodeJS SDK
      user = await dbUserIdentificationMap.findByIdentifier(String(projectId), userIdentifier);
      if (user) {
        return BigInt(user.userId);
      }

      // Auto-identify the user from backend if no user found with the given identifier
      logger.info(
        { 'req.path': req.path, projectId: String(projectId), userIdentifier },
        'Auto-identifying user from backend.',
      );

      const { lockAcquired } = await getUserIdentificationLock(projectId, userIdentifier);
      if (!lockAcquired) {
        // Another request is already creating this user - wait for it to complete
        const existingUser = await waitForUserIdentification(String(projectId), userIdentifier);
        if (existingUser) {
          return BigInt(existingUser.userId);
        }
        // Fallback: if we couldn't find the user after waiting, generate a new one
        // This shouldn't happen normally, but handles edge cases
        logger.warn(
          { projectId: String(projectId), userIdentifier },
          'Could not find user after waiting for identification lock',
        );
      }

      try {
        const userId = generateUserId();
        await identifyUser(
          context,
          {
            identifier: userIdentifier,
            displayName: typeof bodyData.displayName === 'string' ? bodyData.displayName : undefined,
            data: bodyData.userData,
          },
          projectId,
          userId,
        );

        await releaseUserIdentificationLock(projectId, userIdentifier);
        return userId;
      } catch (err) {
        await releaseUserIdentificationLock(projectId, userIdentifier);
        throw err;
      }
    } else {
      if (useBodyIdentifier && bodyData.identifier) {
        // this is the case when the user was already identified in the browser and it sends the identifier from the sessionStorage to the server
        // for the /i (identify) endpoint we ignore it though, because there we want to merge possible events from the old id to the new user id

        user = await dbUserIdentificationMap.findByIdentifier(String(projectId), bodyData.identifier);
        if (user) {
          return BigInt(user.userId);
        }
      }

      if (allowCookies) {
        // if cookies are allowed and at this point no userId could be retrieved, we return null because the user id + cookie will be set later
        return null;
      }

      const userAgent = req.header('user-agent');
      if (userAgent) {
        const { currentSalt, previousSalt } = await dbSalt.getLatestSalts();

        const previousUserId = generateUserId({
          projectId,
          ipAddress,
          userAgent,
          salt: previousSalt?.id ?? '',
        });
        if (await hasActiveSession(projectId, previousUserId)) {
          // if there is a session with the previous user id, we ensure continuity by using the same user id
          return previousUserId;
        }

        return generateUserId({
          projectId,
          ipAddress,
          userAgent,
          salt: currentSalt?.id ?? '',
        });
      } else {
        return generateUserId();
      }
    }
  } catch (err) {
    logger.error({ err, 'req.path': req.path }, 'Failed to get user from request.');
    throw err;
  }
}
