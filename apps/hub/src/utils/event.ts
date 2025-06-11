import { formatClickhouseDate } from '@vemetric/common/date';
import { EventNames } from '@vemetric/common/event';
import { generateEventId } from '@vemetric/common/id';
import { getClientIp } from '@vemetric/common/request-ip';
import { getNormalizedDomain } from '@vemetric/common/url';
import { createDeviceQueue } from '@vemetric/queues/create-device-queue';
import { eventQueue } from '@vemetric/queues/event-queue';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { sessionQueue } from '@vemetric/queues/session-queue';
import { updateUserQueue } from '@vemetric/queues/update-user-queue';
import { generateSessionId, generateUserId } from 'database';
import { HTTPException } from 'hono/http-exception';
import { z } from 'zod';
import type { HonoContext } from '../types';
import { setUserIdCookie } from './cookie';
import { getUserIdFromRequest } from './request';
import { getSessionId, increaseRedisSessionDuration } from './session';

export const eventSchema = z.object({
  name: z.string().min(1),
  url: z.string().url().optional(),
  contextId: z.string().optional(),
  identifier: z.string().optional(),
  displayName: z.string().optional(),
  customData: z.record(z.any()).optional(),
  userData: z
    .object({
      set: z.record(z.string(), z.any()).optional(),
      setOnce: z.record(z.string(), z.any()).optional(),
      unset: z.array(z.string()).optional(),
    })
    .optional(),
});
export type EventSchema = z.infer<typeof eventSchema>;

export function validateSpecialEvents(context: HonoContext, body: EventSchema) {
  switch (body.name) {
    case EventNames.PageView:
      if (body.url === undefined) {
        throw new HTTPException(400, { message: `Missing URL for ${body.name} event` });
      }
      break;
    case EventNames.OutboundLink: {
      if (body.url === undefined) {
        throw new HTTPException(400, { message: `Missing URL for ${body.name} event` });
      }
      if (typeof body.customData?.href !== 'string') {
        throw new HTTPException(400, { message: `Missing HREF for ${body.name} event` });
      }

      const { project } = context.var;
      const href = body.customData.href;
      const externalDomain = getNormalizedDomain(href);
      if (externalDomain.endsWith(project.domain)) {
        // this is actually an internal link, just from / to a different subdomain
        throw new HTTPException(200);
      }
      break;
    }
  }
}

export const trackEvent = async (context: HonoContext, body: EventSchema) => {
  const { req } = context;
  const contextId = body.contextId;
  const { projectId, allowCookies } = context.var;

  let userId = await getUserIdFromRequest(context);

  if (userId === null) {
    userId = generateUserId();
    if (allowCookies) {
      setUserIdCookie(context, userId);
    }
  }

  // session handling
  let sessionId = await getSessionId(projectId, userId);
  if (sessionId === null) {
    sessionId = generateSessionId();
  }
  await increaseRedisSessionDuration(projectId, userId, sessionId);

  const { customData, name, url } = body;

  const headers = req.header();
  delete headers['cookie'];

  const ipAddress = getClientIp(context) ?? '';

  const eventId = generateEventId();

  const now = formatClickhouseDate(new Date());

  await addToQueue(createDeviceQueue, {
    projectId: String(projectId),
    userId: String(userId),
    headers,
  });

  await addToQueue(sessionQueue, {
    type: 'createOrExtend',
    projectId: String(projectId),
    userId: String(userId),
    sessionId,
    createdAt: formatClickhouseDate(new Date()),
    ipAddress,
    headers,
    url,
    reqIdentifier: body?.identifier,
    reqDisplayName: body?.displayName,
  });

  const evenQueueData = {
    projectId: String(projectId),
    userId: String(userId),
    eventId,
    sessionId,
    contextId,
    createdAt: now,
    name,
    headers,
    customData,
    url,
    ipAddress,
    reqIdentifier: body?.identifier,
    reqDisplayName: body?.displayName,
  };
  await addToQueue(eventQueue, evenQueueData, {
    jobId: eventId,
  });

  if (body.userData) {
    await addToQueue(
      updateUserQueue,
      {
        projectId: String(projectId),
        userId: String(userId),
        updatedAt: now,
        data: body.userData,
      },
      {
        delay: 2000, // we delay this a bit so that identification is done first
      },
    );
  }
};
