import { trpcServer } from '@hono/trpc-server';
import * as Sentry from '@sentry/bun';
import { clickhouseClient } from 'clickhouse';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { pinoLogger as honoPino } from 'hono-pino';
import { billingRouter } from './routes/billing';
import { dashboardRouter } from './routes/dashboard';
import { filtersRouter } from './routes/filters';
import { funnelsRouter } from './routes/funnels';
import { useLandingPageMetrics } from './routes/landing-page';
import { organizationRouter } from './routes/organization';
import { paddleWebhookHandler } from './routes/paddle';
import { projectsRouter } from './routes/projects';
import { usersRouter } from './routes/users';
import type { HonoContext, HonoContextVars } from './types';
import { auth, TRUSTED_ORIGINS } from './utils/auth';
import { logger } from './utils/logger';
import { publicProcedure, router } from './utils/trpc';

if (process.env.SENTRY_URL) {
  Sentry.init({
    dsn: process.env.SENTRY_URL,
    integrations: [],
    tracesSampleRate: 0.5,
  });
}

export const appRouter = router({
  dashboard: dashboardRouter,
  filters: filtersRouter,
  funnels: funnelsRouter,
  projects: projectsRouter,
  organization: organizationRouter,
  billing: billingRouter,
  users: usersRouter,

  up: publicProcedure.query(() => {}),
});

const app = new Hono<{ Variables: HonoContextVars }>();

app.use(
  honoPino({
    pino: logger,
    http: {
      onResLevel: (c) => {
        if (c.error) {
          if (c.error instanceof HTTPException && c.error.status === 200) {
            return 'trace';
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
    logger.error({ url, err: context.error, reqContent: content }, 'An error occured');
  }
});

app.use('*', async (context, next) => {
  const session = await auth.api.getSession({ headers: context.req.raw.headers });

  if (!session) {
    context.set('user', null);
    context.set('session', null);
    return next();
  }

  context.set('user', session.user);
  context.set('session', session.session);
  return next();
});

app.use('*', cors({ credentials: true, origin: TRUSTED_ORIGINS }));
app.use(
  '*',
  csrf({
    origin: TRUSTED_ORIGINS,
  }),
);

app.get('/up', ({ text }) => text('', 200));
useLandingPageMetrics(app);

app.on(['POST', 'GET'], '/auth/**', (c) => {
  return auth.handler(c.req.raw);
});

app.post('/takeapaddle', paddleWebhookHandler);

app.use(
  '/trpc/*',
  trpcServer({
    router: appRouter,
    createContext: (_opts, c: HonoContext) => ({
      var: {
        session: c.get('session'),
        user: c.get('user'),
      },
    }),
    onError: ({ error, path, input }) => {
      logger.error({ err: error, path, input }, 'An error occured');
    },
  }),
);

export default {
  port: 4003,
  fetch: app.fetch,
};

process.on('uncaughtException', function (err) {
  logger.error({ err }, 'Uncaught exception');
});
process.on('unhandledRejection', function (err) {
  logger.error({ err }, 'Unhandled rejection');
});

process.on('beforeExit', () => {
  clickhouseClient.close();
});

logger.info('Starting backend');
