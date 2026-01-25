import { accountRouter } from './routes/account';
import { billingRouter } from './routes/billing';
import { dashboardRouter } from './routes/dashboard';
import { eventsRouter } from './routes/events';
import { filtersRouter } from './routes/filters';
import { funnelsRouter } from './routes/funnels';
import { organizationRouter } from './routes/organization';
import { projectsRouter } from './routes/projects';
import { usersRouter } from './routes/users';
import { publicProcedure, router } from './trpc';

export const appRouter = router({
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

export type AppRouter = typeof appRouter;
