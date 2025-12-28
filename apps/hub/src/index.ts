import { formatClickhouseDate } from '@vemetric/common/date';
import { EMPTY_GEO_DATA, getGeoDataFromIp } from '@vemetric/common/geo';
import { getClientIp } from '@vemetric/common/request-ip';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { updateUserDataModel, updateUserQueue } from '@vemetric/queues/update-user-queue';
import { generateUserId } from 'database';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { HTTPException } from 'hono/http-exception';
import { validator } from 'hono/validator';
import { pinoLogger as honoPino } from 'hono-pino';
import { z } from 'zod';
import type { HonoContextVars } from './types';
import { isBot } from './utils/bots';
import { deleteUserIdCookie, setUserIdCookie } from './utils/cookie';
import { eventSchema, trackEvent, validateSpecialEvents } from './utils/event';
import { logger } from './utils/logger';
import { handlePageLeave } from './utils/page-leave';
import { getProjectByToken } from './utils/project';
import { getUserIdentificationLock, releaseUserIdentificationLock } from './utils/redis';
import { getUserIdFromRequest, isPrefetchRequest } from './utils/request';
import { identifySchema, identifyUser } from './utils/user';

const app = new Hono<{ Variables: HonoContextVars }>();

app.use(
  honoPino({
    pino: logger,
    http: {
      onReqBindings: (c) => {
        return {
          url: c.req.path,
          method: c.req.method,
          headers: {
            'v-host': c.req.header('v-host') || '',
            'v-referrer': c.req.header('v-referrer') || '',
            'v-sdk': c.req.header('v-sdk') || '',
            'v-sdk-version': c.req.header('v-sdk-version') || '',
          },
        };
      },
      onResLevel: (c) => {
        if (c.error) {
          if (c.error instanceof HTTPException) {
            if (c.error.status === 200) {
              return 'trace';
            }
            // Client errors (4xx) are expected - log at warn level, not error
            if (c.error.status >= 400 && c.error.status < 500) {
              return 'warn';
            }
          }
          return 'error';
        }

        return 'trace';
      },
    },
  }),
);

app.use('*', async (context, next) => {
  let content = '';
  let url = '';
  try {
    const reqClone = context.req.raw.clone();
    url = reqClone.url;
    content = reqClone.body ? await Bun.readableStreamToText(reqClone.body) : '';
  } catch (err) {
    logger.error({ err }, 'Error while cloning and reading req body content');
  }

  await next();

  if (context.error) {
    if (context.error instanceof HTTPException) {
      // Skip logging for silently filtered events (200) and expected client errors (4xx)
      if (context.error.status === 200 || (context.error.status >= 400 && context.error.status < 500)) {
        return;
      }
    }
    logger.error({ url, err: context.error, 'req.body': content }, 'An error occured');
  }
});

app.use('*', async (context, next) => {
  const { req } = context;

  // TODO: let users specify allowed origins for their project
  const middleware = cors({ credentials: true, origin: req.header('origin') ?? '*' });

  if (req.method === 'OPTIONS' || req.path === '/up') {
    return middleware(context, next);
  }

  let bodyData: any = {};
  try {
    bodyData = await req.json();
  } catch {
    // ignore json parse errors here
  }

  const isBackendRequest = typeof bodyData.userIdentifier === 'string';
  context.set('isBackendRequest', isBackendRequest);

  const ipAddress = getClientIp(context) ?? '';
  context.set('ipAddress', ipAddress);

  // for backend requests, we're defaulting to Empty Geo Data because we don't want to use the servers country in our analytics data
  // in a later point we try to use the users Geo Data, but as default it should be Empty = Unknown
  const geoData = isBackendRequest ? EMPTY_GEO_DATA : await getGeoDataFromIp(ipAddress, logger);
  context.set('geoData', geoData);

  if (isBot(context)) {
    return context.text('', 200);
  }

  const project = await getProjectByToken(context, bodyData);
  context.set('project', project);
  context.set('projectId', BigInt(project.id));

  if (project.excludedIps && ipAddress) {
    // Use comma-wrapped check to avoid array allocation on every request
    if (`,${project.excludedIps},`.includes(`,${ipAddress},`)) {
      // Silently ignore requests from excluded IPs
      return context.text('', 200);
    }
  }

  if (project.excludedCountries && geoData.countryCode) {
    if (`,${project.excludedCountries},`.includes(`,${geoData.countryCode},`)) {
      // Silently ignore requests from excluded countries
      return context.text('', 200);
    }
  }

  let allowCookies = false;
  const allowCookiesHeader = req.header('allow-cookies');
  if (allowCookiesHeader === undefined) {
    try {
      // we're falling back to reading it from the body because of beacon requests where we can't send it via the header
      allowCookies = bodyData['Allow-Cookies'] === 'true';
    } catch (err) {
      logger.error({ err, 'req.path': req.path }, 'Failed to get allowCookies from body.');
    }
  } else {
    allowCookies = allowCookiesHeader === 'true';
  }
  context.set('allowCookies', allowCookies);

  context.set('proxyHost', req.header('V-Host'));

  return middleware(context, next);
});
app.get('/up', ({ text }) => text('', 200));

app.post(
  '/i',
  validator('json', (value, c) => {
    const parsed = identifySchema.safeParse(value);
    if (!parsed.success) {
      return c.text('Invalid!', 400);
    }
    return parsed.data;
  }),
  async (context) => {
    const { req } = context;
    const body = req.valid('json');
    const { identifier } = body;

    const { projectId } = context.var;

    const { lockAcquired } = await getUserIdentificationLock(projectId, identifier);
    if (!lockAcquired) {
      logger.info({ projectId: String(projectId), identifier }, 'Identification already running');
      return context.text('Identification is running', 202);
    }

    try {
      const userId = await getUserIdFromRequest(context, false);
      const response = await identifyUser(context, body, projectId, userId);

      await releaseUserIdentificationLock(projectId, identifier);

      return response;
    } catch (err) {
      await releaseUserIdentificationLock(projectId, identifier);
      logger.error({ err }, 'Error identifying user');
      throw err;
    }
  },
);

const updateUserDataSchema = z.object({
  data: updateUserDataModel.optional(),
  displayName: z.string().optional(),
  avatarUrl: z.string().optional(),
});

app.post(
  '/u',
  validator('json', (value, c) => {
    const parsed = updateUserDataSchema.safeParse(value);
    if (!parsed.success) {
      return c.text('Invalid!', 400);
    }
    return parsed.data;
  }),
  async (context) => {
    const { projectId } = context.var;
    const body = context.req.valid('json');

    const userId = await getUserIdFromRequest(context);
    if (userId === null) {
      return context.text('No user found', 400);
    }

    await addToQueue(
      updateUserQueue,
      {
        projectId: String(projectId),
        userId: String(userId),
        updatedAt: formatClickhouseDate(new Date()),
        data: body.data,
        displayName: body.displayName,
        avatarUrl: body.avatarUrl,
      },
      {
        delay: 2000, // we delay this a bit so that identification is done first
      },
    );

    return context.text('', 200);
  },
);

app.post('/r', async (context) => {
  const { text } = context;

  const { allowCookies } = context.var;

  if (allowCookies) {
    const newUserId = generateUserId();
    setUserIdCookie(context, newUserId);
  } else {
    deleteUserIdCookie(context);
  }

  return text('', 200);
});

app.post('/l', async (context) => {
  return handlePageLeave(context);
});

app.post(
  '/e',
  validator('json', (value, c) => {
    const parsed = eventSchema.safeParse(value);
    if (!parsed.success) {
      return c.text('Invalid!', 400);
    }
    return parsed.data;
  }),
  async (context) => {
    const { req, text } = context;

    if (isPrefetchRequest(req)) {
      return text('', 200);
    }

    const body = req.valid('json');

    validateSpecialEvents(context, body);

    await trackEvent(context, body);

    return text('', 200);
  },
);

process.on('uncaughtException', function (err) {
  logger.error({ err }, 'Uncaught exception');
});
process.on('unhandledRejection', function (err) {
  logger.error({ err }, 'Unhandled rejection');
});

export default {
  port: 4004,
  fetch: app.fetch,
};

logger.info('Starting hub');
