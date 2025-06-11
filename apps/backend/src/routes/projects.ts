import { TRPCError } from '@trpc/server';
import { TIME_SPAN_DATA } from '@vemetric/common/charts/timespans';
import { getNormalizedDomain } from '@vemetric/common/url';
import { clickhouseEvent } from 'clickhouse';
import { ProjectRole, dbProject } from 'database';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { fillTimeSeries, getStartDate } from '../utils/timeseries';
import { loggedInProcedure, organizationProcedure, projectProcedure, router } from '../utils/trpc';
import { vemetric } from '../utils/vemetric-client';

const projectNameInput = z.string().min(2);
const projectInput = z.object({ name: projectNameInput, domain: z.string() });

export const projectsRouter = router({
  create: organizationProcedure.input(projectInput).mutation(async (opts) => {
    const {
      input: { name, domain },
      ctx: { user, organization, subscriptionStatus },
    } = opts;

    if (!subscriptionStatus.isActive) {
      const existingProjects = await dbProject.findByOrganizationId(organization.id);
      if (existingProjects.length > 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Please upgrade to a higher plan if you want to create more than 2 projects.',
        });
      }
    }

    const splittedDomain = domain.split('.');
    if (splittedDomain.length < 2 || splittedDomain[0].length < 3 || splittedDomain[1].length < 2) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid domain' });
    }

    let resolvedDomain: string;
    try {
      let url = domain;
      if (!url.startsWith('http://') && !url.startsWith('https://')) {
        url = 'https://' + url;
      }

      resolvedDomain = getNormalizedDomain(url);
    } catch (err) {
      logger.error({ err, domain }, 'Domain resolution error');
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid domain' });
    }

    const existingProject = await dbProject.findByDomain(resolvedDomain);
    if (existingProject) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'There already exists a project with this domain' });
    }

    try {
      const project = await dbProject.create(name, resolvedDomain, organization.id);
      await dbProject.addUser(project.id, user.id, ProjectRole.ADMIN);

      try {
        await vemetric.trackEvent('ProjectCreated', {
          userIdentifier: user.id,
          eventData: { projectId: project.id, domain: resolvedDomain },
          userData: { setOnce: { createdProject: true, projectDomain: resolvedDomain } },
        });
      } catch (err) {
        logger.error({ err, resolvedDomain, name }, 'Track event error');
      }

      return { id: String(project.id) };
    } catch (err) {
      logger.error({ err }, 'Project creation error');

      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    }
  }),

  settings: projectProcedure.query(async (opts) => {
    const {
      ctx: { project },
    } = opts;

    return {
      name: project.name,
      domain: project.domain,
      token: project.token,
      publicDashboard: project.publicDashboard,
    };
  }),

  edit: projectProcedure.input(z.object({ name: projectNameInput })).mutation(async (opts) => {
    const {
      input: { name },
    } = opts;

    const projectId = String(opts.ctx.projectId);

    await dbProject.update(projectId, { name });

    return { id: projectId };
  }),

  togglePublic: projectProcedure.mutation(async (opts) => {
    const {
      ctx: { project },
    } = opts;

    await dbProject.update(project.id, { publicDashboard: !project.publicDashboard });
  }),

  overview: loggedInProcedure.query(async (opts) => {
    const {
      ctx: { user },
    } = opts;

    const timespan = '24hrs';
    const timeSpanData = TIME_SPAN_DATA[timespan];
    const startDate = getStartDate(timespan);

    const projects = await dbProject.findByUserId(user.id);
    const projectData = await Promise.all(
      projects.map(async ({ project }) => {
        const projectId = BigInt(project.id);

        const dataPromises = Promise.all([
          clickhouseEvent.getCurrentActiveUsers(projectId),
          clickhouseEvent.getActiveUserTimeSeries(projectId, timespan, startDate),
          clickhouseEvent.getActiveUsers(projectId, startDate),
        ]);

        return {
          project,
          dataPromises,
        };
      }),
    );

    return (
      await Promise.all(
        projectData.map(async ({ project, dataPromises }) => {
          const [currentActiveUsers, activeUsersTimeSeries, activeUsers] = await dataPromises;

          const activeUserTimeSeries = fillTimeSeries(activeUsersTimeSeries, startDate, timeSpanData.interval);

          return {
            id: String(project.id),
            name: project.name,
            domain: project.domain,
            currentActiveUsers,
            activeUserTimeSeries,
            activeUsers: activeUsers ?? 0,
          };
        }),
      )
    ).sort((a, b) => b.activeUsers - a.activeUsers);
  }),
});
