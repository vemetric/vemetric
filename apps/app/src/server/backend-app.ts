import { trpcServer } from '@hono/trpc-server';
import { getClientIp } from '@vemetric/common/request-ip';
import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { csrf } from 'hono/csrf';
import { HTTPException } from 'hono/http-exception';
import { pinoLogger as honoPino } from 'hono-pino';
import { accountRouter } from './routes/account';
import { billingRouter } from './routes/billing';
import { dashboardRouter } from './routes/dashboard';
import { useEmailRoutes } from './routes/email';
import { eventsRouter } from './routes/events';
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

export const trpcRouter = router({
  account: accountRouter,
  dashboard: dashboardRouter,
  events: eventsRouter,
  filters: filtersRouter,
  funnels: funnelsRouter,
  projects: projectsRouter,
  organization: organizationRouter,
  billing: billingRouter,
  users: usersRouter,

  up: publicProcedure.query(() => {}),
});

export function createBackendApp() {
  const backendApp = new Hono<{ Variables: HonoContextVars }>();

  backendApp.use(
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

  backendApp.use('*', async (context, next) => {
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
      // Skip logging for expected client errors (4xx)
      if (context.error instanceof HTTPException && context.error.status >= 400 && context.error.status < 500) {
        return;
      }
      logger.error({ url, err: context.error, reqContent: content }, 'An error occured');
    }
  });

  backendApp.use('*', async (context, next) => {
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

  backendApp.use('*', cors({ credentials: true, origin: TRUSTED_ORIGINS }));
  backendApp.use(
    '*',
    csrf({
      origin: TRUSTED_ORIGINS,
    }),
  );

  backendApp.use('*', async (c, next) => {
    await next();
    if (!c.res.headers.has('Cache-Control')) {
      c.header('Cache-Control', 'no-store');
    }
  });

  backendApp.get('/up', ({ text }) => text('', 200));

  useEmailRoutes(backendApp);
  useLandingPageMetrics(backendApp);

  backendApp.on(['POST', 'GET'], '/auth/**', (c) => {
    return auth.handler(c.req.raw);
  });

  backendApp.post('/takeapaddle', paddleWebhookHandler);

  backendApp.use(
    '/trpc/*',
    trpcServer({
      endpoint: '/_api/trpc',
      router: trpcRouter,
      createContext: (_opts, c: HonoContext) => ({
        var: {
          ipAddress: getClientIp(c) ?? null,
          session: c.get('session'),
          user: c.get('user'),
        },
      }),
      onError: ({ error, path, input }) => {
        // Only log actual server errors, not expected client errors (UNAUTHORIZED, FORBIDDEN, NOT_FOUND, BAD_REQUEST)
        const clientErrorCodes = ['UNAUTHORIZED', 'FORBIDDEN', 'NOT_FOUND', 'BAD_REQUEST'];
        if (clientErrorCodes.includes(error.code)) {
          return;
        }
        logger.error({ err: error, path, input }, 'An error occured');
      },
    }),
  );

  return backendApp;
}
