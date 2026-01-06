import { TRPCError } from '@trpc/server';
import { TIME_SPAN_DATA } from '@vemetric/common/charts/timespans';
import { MAX_EXCLUDED_COUNTRIES } from '@vemetric/common/countries';
import { getNormalizedDomain } from '@vemetric/common/url';
import { getDripSequence, getStepDelay } from '@vemetric/email/email-drip-sequences';
import { emailDripQueue } from '@vemetric/queues/email-drip-queue';
import { addToQueue } from '@vemetric/queues/queue-utils';
import { clickhouseEvent } from 'clickhouse';
import { dbOrganization, dbProject } from 'database';
import { z } from 'zod';
import { logger } from '../utils/logger';
import { fillTimeSeries, getTimeSpanStartDate } from '../utils/timeseries';
import {
  organizationAdminProcedure,
  organizationProcedure,
  projectOrPublicProcedure,
  projectProcedure,
  router,
} from '../utils/trpc';
import { vemetric } from '../utils/vemetric-client';

const projectNameInput = z.string().min(2);
const projectInput = z.object({ name: projectNameInput, domain: z.string() });

export const projectsRouter = router({
  create: organizationAdminProcedure.input(projectInput).mutation(async (opts) => {
    const {
      input: { name, domain },
      ctx: { user, organization, subscriptionStatus },
    } = opts;

    // Ensure organization has completed pricing onboarding before creating projects
    if (!organization.pricingOnboarded) {
      throw new TRPCError({
        code: 'FORBIDDEN',
        message: 'Please complete pricing onboarding step before creating a project.',
      });
    }

    if (!subscriptionStatus.isActive) {
      const existingProjects = await dbProject.findByOrganizationId(organization.id);
      if (existingProjects.length > 1) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: 'Please upgrade to a higher plan if you want to create more than 2 projects.',
        });
      }
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

    const splittedDomain = resolvedDomain.split('.');
    if (splittedDomain.length < 2 || splittedDomain[0].length < 3 || splittedDomain[1].length < 2) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'Invalid domain' });
    }

    const existingProject = await dbProject.findByDomain(resolvedDomain);
    if (existingProject) {
      throw new TRPCError({ code: 'BAD_REQUEST', message: 'There already exists a project with this domain' });
    }

    try {
      const project = await dbProject.create(name, resolvedDomain, organization.id);

      try {
        await vemetric.trackEvent('ProjectCreated', {
          userIdentifier: user.id,
          userDisplayName: user.name,
          eventData: { projectId: project.id, domain: resolvedDomain },
          userData: { setOnce: { createdProject: true, projectDomain: resolvedDomain } },
        });
      } catch (err) {
        logger.error({ err, resolvedDomain, name }, 'Track event error');
      }

      try {
        const sequence = getDripSequence('NO_EVENTS');
        logger.info(
          { projectId: project.id, queueName: emailDripQueue.name, sequence },
          'Queuing project for email drip sequence',
        );
        await addToQueue(
          emailDripQueue,
          {
            projectId: project.id,
            sequenceType: sequence.type,
            stepNumber: 0,
          },
          {
            delay: getStepDelay(sequence.type, 0),
          },
        );
      } catch (err) {
        logger.error(
          {
            err,
            projectId: project.id,
            domain: resolvedDomain,
          },
          'Failed to queue project for email drip sequence',
        );
      }

      return { id: String(project.id) };
    } catch (err) {
      logger.error({ err }, 'Project creation error');

      throw new TRPCError({ code: 'INTERNAL_SERVER_ERROR' });
    }
  }),

  settings: projectProcedure.query(async (opts) => {
    const {
      ctx: {
        project,
        var: { ipAddress },
      },
    } = opts;

    return {
      name: project.name,
      domain: project.domain,
      token: project.token,
      isActive: project.firstEventAt !== null,
      publicDashboard: project.publicDashboard,
      excludedIps: project.excludedIps ? project.excludedIps.split(',') : [],
      excludedCountries: project.excludedCountries ? project.excludedCountries.split(',') : [],
      currentIp: ipAddress,
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

  overview: organizationProcedure.query(async (opts) => {
    const {
      ctx: { organizationId, user },
    } = opts;

    const timeSpan = '24hrs';
    const timeSpanData = TIME_SPAN_DATA[timeSpan];
    const startDate = getTimeSpanStartDate(timeSpan);

    const allProjects = await dbProject.findByOrganizationId(organizationId);
    const projects = await dbOrganization.filterProjectsByUserAccess(user.id, allProjects);
    const projectData = await Promise.all(
      projects.map(async (project) => {
        const projectId = BigInt(project.id);

        const dataPromises = Promise.all([
          clickhouseEvent.getCurrentActiveUsers(projectId),
          clickhouseEvent.getActiveUserTimeSeries(projectId, { timeSpan, startDate, filterQueries: '' }),
          clickhouseEvent.getActiveUsers(projectId, { startDate }),
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

  getEventIcons: projectOrPublicProcedure.query(async (opts) => {
    const {
      ctx: { project },
    } = opts;

    return project.eventIcons as Record<string, string>;
  }),

  setEventIcon: projectProcedure
    .input(z.object({ eventName: z.string(), emoji: z.string() }))
    .mutation(async (opts) => {
      const {
        input: { eventName, emoji },
        ctx: { project },
      } = opts;

      const currentIcons = (project.eventIcons as Record<string, string>) || {};
      const updatedIcons = { ...currentIcons, [eventName]: emoji };

      await dbProject.update(project.id, { eventIcons: updatedIcons });

      return updatedIcons;
    }),

  removeEventIcon: projectProcedure.input(z.object({ eventName: z.string() })).mutation(async (opts) => {
    const {
      input: { eventName },
      ctx: { project },
    } = opts;

    const currentIcons = (project.eventIcons as Record<string, string>) || {};
    const updatedIcons = { ...currentIcons };
    delete updatedIcons[eventName];

    await dbProject.update(project.id, { eventIcons: updatedIcons });

    return updatedIcons;
  }),

  addExcludedIp: projectProcedure.input(z.object({ ip: z.string().ip() })).mutation(async (opts) => {
    const {
      input: { ip },
      ctx: { project },
    } = opts;

    // Get current excluded IPs
    const currentIps = project.excludedIps ? project.excludedIps.split(',') : [];

    // Check if IP already exists
    if (currentIps.includes(ip)) {
      throw new TRPCError({
        code: 'BAD_REQUEST',
        message: 'This IP address is already excluded',
      });
    }

    // Add new IP and update
    currentIps.push(ip);
    const excludedIpsString = currentIps.join(',');
    await dbProject.update(project.id, { excludedIps: excludedIpsString });

    return { excludedIps: currentIps };
  }),

  removeExcludedIp: projectProcedure.input(z.object({ ip: z.string() })).mutation(async (opts) => {
    const {
      input: { ip },
      ctx: { project },
    } = opts;

    // Get current excluded IPs
    const currentIps = project.excludedIps ? project.excludedIps.split(',') : [];

    // Filter out the IP to remove
    const updatedIps = currentIps.filter((existingIp) => existingIp !== ip);

    // Update database
    const excludedIpsString = updatedIps.length > 0 ? updatedIps.join(',') : null;
    await dbProject.update(project.id, { excludedIps: excludedIpsString });

    return { excludedIps: updatedIps };
  }),

  addExcludedCountries: projectProcedure
    .input(
      z.object({
        countryCodes: z.array(
          z
            .string()
            .length(2)
            .regex(/^[A-Z]{2}$/),
        ),
      }),
    )
    .mutation(async (opts) => {
      const {
        input: { countryCodes },
        ctx: { project },
      } = opts;

      const currentCountries = project.excludedCountries ? project.excludedCountries.split(',') : [];
      const newCountries = Array.from(new Set([...currentCountries, ...countryCodes]));

      if (newCountries.length > MAX_EXCLUDED_COUNTRIES) {
        throw new TRPCError({
          code: 'BAD_REQUEST',
          message: `Maximum ${MAX_EXCLUDED_COUNTRIES} countries can be excluded`,
        });
      }

      const excludedCountriesString = newCountries.join(',');
      await dbProject.update(project.id, { excludedCountries: excludedCountriesString });

      return { excludedCountries: newCountries };
    }),

  removeExcludedCountry: projectProcedure.input(z.object({ countryCode: z.string() })).mutation(async (opts) => {
    const {
      input: { countryCode },
      ctx: { project },
    } = opts;

    const currentCountries = project.excludedCountries ? project.excludedCountries.split(',') : [];
    const updatedCountries = currentCountries.filter((existing: string) => existing !== countryCode);
    const excludedCountriesString = updatedCountries.length > 0 ? updatedCountries.join(',') : null;

    await dbProject.update(project.id, { excludedCountries: excludedCountriesString });

    return { excludedCountries: updatedCountries };
  }),
});
