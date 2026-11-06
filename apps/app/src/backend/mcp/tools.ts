import type { McpServer, ToolAnnotations } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { listCallerProjects, type McpCaller } from './caller';
import { runCallerTool, runProjectTool } from './run-tool';
import { analyticsQueryRequestSchema } from '../api/schemas/analytics';
import { eventPropertiesRequestSchema } from '../api/schemas/event-properties';
import { filterValuesRequestSchema } from '../api/schemas/filter-values';
import { funnelIdSchema, funnelResultsRequestSchema } from '../api/schemas/funnels';
import { userEventsRequestSchema, userSingleQuerySchema, usersListRequestSchema } from '../api/schemas/users';
import { queryAnalytics } from '../api/services/analytics';
import { listEventProperties } from '../api/services/event-properties';
import { getFilterValues } from '../api/services/filter-values';
import { getFunnelResults, listFunnels } from '../api/services/funnels';
import { getProject, listProjects } from '../api/services/project';
import { getUser, getUserEvents, listUsers } from '../api/services/users';

const annotations: ToolAnnotations = { readOnlyHint: true, openWorldHint: false };

const projectId = z
  .string()
  .optional()
  .describe('ID of the project (from list_projects). Can be omitted if you only have access to one project.');

const dateRange = analyticsQueryRequestSchema.shape.dateRange.describe(
  'Period in UTC. Either a preset ("live" = last 5 minutes, "1hr", "24hrs", "7days" and "30days" include today, "3months", "6months", "1year"), or [start, end] with YYYY-MM-DD dates (the end date includes the whole day) or UTC timestamps like 2026-01-31T12:00:00Z. get_project returns today\'s date.',
);

const filters = analyticsQueryRequestSchema.shape.filters.describe(
  'Optional filters. Each one has a "type" (page, event, user, location, referrer, referrerUrl, referrerType, utmTags, browser, device, os, funnel). Examples: {"type":"page","path":{"operator":"startsWith","value":"/blog"}}, {"type":"event","name":{"operator":"eq","value":"signup"},"properties":[{"property":"plan","operator":"eq","value":"pro"}]}, {"type":"location","country":{"operator":"oneOf","value":["US","DE"]}}, {"type":"referrer","operator":"eq","value":"Google"}, {"type":"utmTags","utmCampaign":{"operator":"eq","value":"newsletter"}}, {"type":"device","operator":"oneOf","value":["mobile"]}. Look up exact values with list_filter_values first.',
);

const filtersOperator = analyticsQueryRequestSchema.shape.filtersOperator.describe(
  'How to combine several filters: "and" (default) or "or".',
);

function limit(defaultLimit: number, what: string) {
  return z.number().int().min(1).max(1000).default(defaultLimit).describe(`Maximum number of ${what} to return.`);
}

const offset = z.number().int().min(0).default(0).describe('Number of items to skip, to get the next page.');

const userReference = {
  id: userSingleQuerySchema.shape.id.describe("Vemetric's internal user id (from list_users)."),
  identifier: userSingleQuerySchema.shape.identifier.describe(
    'The identifier the website uses for the user, e.g. an email address or its own user id.',
  ),
};

function withHasMore(pagination: { limit: number; offset: number; returned: number }) {
  return { ...pagination, hasMore: pagination.returned === pagination.limit };
}

function withoutAvatar<T extends { avatarUrl?: unknown }>({ avatarUrl: _avatarUrl, ...user }: T) {
  return user;
}

export function registerTools(server: McpServer, caller: McpCaller) {
  server.registerTool(
    'list_projects',
    {
      title: 'List projects',
      description:
        "List the Vemetric projects (websites or apps) you can access, with id, name and domain. Call it first when the user has several projects or doesn't say which one they mean.",
      annotations,
    },
    () => runCallerTool({ tool: 'list_projects', caller }, async () => listProjects(await listCallerProjects(caller))),
  );

  server.registerTool(
    'get_project',
    {
      title: 'Get project',
      description:
        'Get a project\'s name, domain, creation date and first event, its Vemetric plan with the data it includes, and today\'s date in UTC to resolve relative dates like "last week".',
      inputSchema: z.object({ projectId }),
      annotations,
    },
    (input) =>
      runProjectTool({ tool: 'get_project', caller, input }, async (ctx) => {
        const { project } = getProject(ctx);
        const isPaid = ctx.subscriptionStatus.isActive;
        return {
          project: {
            id: project.id,
            name: project.name,
            domain: project.domain,
            createdAt: project.createdAt,
            firstEventAt: project.firstEventAt,
          },
          plan: {
            name: isPaid ? 'Professional' : 'Free',
            dataRetention: isPaid
              ? 'All data'
              : 'Last 30 days (the 3months, 6months and 1year presets are not available)',
          },
          today: new Date().toISOString().slice(0, 10),
        };
      }),
  );

  server.registerTool(
    'query_analytics',
    {
      title: 'Query analytics',
      description:
        'Query aggregated web and product analytics: users (unique visitors), pageviews, events (custom events), bounceRate (%) and visitDuration (seconds). Without groupBy it returns the totals of the period. Group by one dimension: "interval:auto" for a time series, a field like "page:path", "referrer", "referrerType", "country", "deviceType", "utmCampaign" or "event:name", or "event:prop:<name>" for a custom event property (find names with list_event_properties). bounceRate and visitDuration are null where they don\'t apply to the grouping (e.g. per page or per event). Sort with orderBy, page with limit and offset (hasMore tells if there are more rows).',
      inputSchema: analyticsQueryRequestSchema.safeExtend({
        projectId,
        dateRange,
        metrics: analyticsQueryRequestSchema.shape.metrics.describe(
          'Metrics to return. Default: users, pageviews, events, bounceRate and visitDuration.',
        ),
        groupBy: analyticsQueryRequestSchema.shape.groupBy.describe(
          'At most one dimension to group by, e.g. ["page:path"]. Empty for totals.',
        ),
        orderBy: analyticsQueryRequestSchema.shape.orderBy.describe(
          'At most one [field, direction] pair, e.g. [["pageviews","desc"]]. The field is a metric, the groupBy field or "date".',
        ),
        limit: limit(20, 'rows'),
        offset,
        filters,
        filtersOperator,
      }),
      annotations,
    },
    (input) =>
      runProjectTool({ tool: 'query_analytics', caller, input }, async (ctx) => {
        const { period, pagination, data } = await queryAnalytics(ctx, input);
        return {
          period,
          pagination: { ...pagination, hasMore: input.groupBy.length > 0 && pagination.returned === pagination.limit },
          data,
        };
      }),
  );

  server.registerTool(
    'list_filter_values',
    {
      title: 'List filter values',
      description:
        'List the values that occur for fields in a period, e.g. event names, page paths, referrers, countries (ISO codes), UTM values or browsers. Use it to find exact values before filtering, or to answer which values exist. Values are sorted alphabetically, not by traffic: use query_analytics with groupBy for rankings.',
      inputSchema: filterValuesRequestSchema.safeExtend({
        projectId,
        dateRange,
        fields: filterValuesRequestSchema.shape.fields.describe('Fields to list the values of, e.g. ["event:name"].'),
        limit: limit(50, 'values per field'),
        offset,
      }),
      annotations,
    },
    (input) =>
      runProjectTool({ tool: 'list_filter_values', caller, input }, async (ctx) => {
        const { period, data } = await getFilterValues(ctx, input);
        return {
          period,
          data: data.map(({ field, pagination, values }) => ({ field, values, pagination: withHasMore(pagination) })),
        };
      }),
  );

  server.registerTool(
    'list_event_properties',
    {
      title: 'List event properties',
      description:
        'List the property names of a custom event (e.g. "plan" of a "signup" event) with how many events and users have them. Use the names in query_analytics with groupBy "event:prop:<name>", or in event filters. Find event names with list_filter_values (field "event:name").',
      inputSchema: eventPropertiesRequestSchema.safeExtend({
        projectId,
        eventName: eventPropertiesRequestSchema.shape.eventName.describe('Exact name of the custom event.'),
        dateRange,
        filters,
        filtersOperator,
        limit: limit(50, 'properties'),
        offset,
      }),
      annotations,
    },
    (input) =>
      runProjectTool({ tool: 'list_event_properties', caller, input }, async (ctx) => {
        const { period, pagination, properties } = await listEventProperties(ctx, input);
        return { period, pagination: withHasMore(pagination), properties };
      }),
  );

  server.registerTool(
    'list_users',
    {
      title: 'List users',
      description:
        'List the tracked users (identified and anonymous) that were active in the period, most recently seen first by default. Filter them, e.g. users from a country who visited a page, and sort them, e.g. by when they last fired a custom event.',
      inputSchema: usersListRequestSchema.safeExtend({
        projectId,
        dateRange,
        filters,
        filtersOperator,
        orderBy: usersListRequestSchema.shape.orderBy.describe(
          'Optional sorting, e.g. [["lastSeenAt","desc"]], or by when users last fired an event: [["lastEventFired","desc",{"name":{"operator":"eq","value":"signup"}}]].',
        ),
        limit: limit(20, 'users'),
        offset,
      }),
      annotations,
    },
    (input) =>
      runProjectTool({ tool: 'list_users', caller, input }, async (ctx) => {
        const { period, pagination, users } = await listUsers(ctx, input);
        return { period, pagination: withHasMore(pagination), users: users.map(withoutAvatar) };
      }),
  );

  server.registerTool(
    'get_user',
    {
      title: 'Get user',
      description:
        "Get one user by Vemetric's user id or by the website's identifier for them (e.g. an email address): location, when they were last seen and their custom data.",
      inputSchema: userSingleQuerySchema.safeExtend({ projectId, ...userReference }),
      annotations,
    },
    (input) =>
      runProjectTool({ tool: 'get_user', caller, input }, async (ctx) => {
        const { user } = await getUser(ctx, input);
        return { user: withoutAvatar(user) };
      }),
  );

  server.registerTool(
    'get_user_events',
    {
      title: 'Get user events',
      description:
        "List the events of one user (pageviews and custom events), newest first, e.g. to see what someone did. Identify the user by Vemetric's user id or by the website's identifier for them.",
      inputSchema: userEventsRequestSchema
        .safeExtend({
          projectId,
          ...userReference,
          dateRange,
          filters: userEventsRequestSchema.shape.filters.describe(
            'Optional filters of type event, page, browser, device or os, e.g. {"type":"event","name":{"operator":"eq","value":"signup"}}.',
          ),
          filtersOperator,
          limit: limit(50, 'events'),
          offset,
        })
        .superRefine((data, ctx) => {
          if ((data.id === undefined) === (data.identifier === undefined)) {
            ctx.addIssue({ code: 'custom', path: ['id'], message: 'Provide exactly one of id or identifier' });
          }
        }),
      annotations,
    },
    (input) =>
      runProjectTool({ tool: 'get_user_events', caller, input }, async (ctx) => {
        const { period, pagination, events } = await getUserEvents(ctx, input, input);
        return { period, pagination: withHasMore(pagination), events };
      }),
  );

  server.registerTool(
    'list_funnels',
    {
      title: 'List funnels',
      description: "List the project's funnels with their ids, names and steps.",
      inputSchema: z.object({ projectId }),
      annotations,
    },
    (input) => runProjectTool({ tool: 'list_funnels', caller, input }, (ctx) => listFunnels(ctx)),
  );

  server.registerTool(
    'get_funnel_results',
    {
      title: 'Get funnel results',
      description:
        'Get the results of a funnel in a period: users per step, step-to-step conversion and overall conversion (in %). Compare segments by calling it once per filter, e.g. with and without a referrer filter.',
      inputSchema: funnelResultsRequestSchema.safeExtend({
        projectId,
        funnelId: funnelIdSchema.describe('Funnel id (from list_funnels).'),
        dateRange,
        filters,
        filtersOperator,
      }),
      annotations,
    },
    (input) =>
      runProjectTool({ tool: 'get_funnel_results', caller, input }, async (ctx) => {
        const { period, funnel, results } = await getFunnelResults(ctx, input.funnelId, input);
        return { period, funnel, results };
      }),
  );
}
