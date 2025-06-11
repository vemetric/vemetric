import { getClientIp } from '@vemetric/common/request-ip';
import type { UserIdentificationMap } from 'database';
import { dbSalt, dbUserIdentificationMap, generateUserId } from 'database';
import type { HonoRequest } from 'hono';
import { HTTPException } from 'hono/http-exception';
import { getUserIdFromCookie } from './cookie';
import type { HonoContext } from '../types';
import { logger } from './logger';
import { hasActiveSession } from './session';

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
      if (!user) {
        logger.error({ 'req.path': req.path, projectId, userIdentifier }, "Couldn't find user by identifier.");
        throw new HTTPException(401);
      }

      return BigInt(user.userId);
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
        const ipAddress = getClientIp(context) ?? '';
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
