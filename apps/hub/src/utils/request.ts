import type { UserIdentificationMap } from 'database';
import { dbSalt, dbUserIdentificationMap, generateUserId } from 'database';
import type { HonoRequest } from 'hono';
import { getUserIdFromCookie } from './cookie';
import type { HonoContext } from '../types';
import { logger } from './logger';
import { hasActiveSession } from './session';
import { identifyUser } from './user';

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
  const { projectId, allowCookies } = context.var;

  try {
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

      // A backend request has no anonymous activity to merge. If another request identifies the
      // same user concurrently, findOrCreate returns its id instead of creating a duplicate.
      return await identifyUser(
        context,
        {
          identifier: userIdentifier,
          displayName: typeof bodyData.displayName === 'string' ? bodyData.displayName : undefined,
          data: bodyData.userData,
        },
        projectId,
        null,
      );
    } else {
      if (useBodyIdentifier && typeof bodyData.identifier === 'string' && bodyData.identifier) {
        // this is the case when the user was already identified in the browser and it sends the identifier from the sessionStorage to the server
        // for the /i (identify) endpoint we ignore it though, because there we want to merge possible events from the old id to the new user id
        // it takes precedence over the cookie, which can belong to another user

        user = await dbUserIdentificationMap.findByIdentifier(String(projectId), bodyData.identifier);
        if (user) {
          return BigInt(user.userId);
        }
      }

      if (allowCookies) {
        // in cookie mode the user id comes from the cookie
        // if there is none, we return null because the user id + cookie will be set later
        return getUserIdFromCookie(context);
      }

      return (await getHashedUserId(context)) ?? generateUserId();
    }
  } catch (err) {
    logger.error({ err, 'req.path': req.path }, 'Failed to get user from request.');
    throw err;
  }
}

/**
 * The cookieless id of a request: a hash of project, IP address and browser with the salt of the
 * day. A visitor whose session started with the previous salt keeps that id. Null without a
 * user agent.
 */
export async function getHashedUserId(context: HonoContext): Promise<bigint | null> {
  const { projectId, ipAddress } = context.var;
  const userAgent = context.req.header('user-agent');
  if (!userAgent) {
    return null;
  }
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
}
