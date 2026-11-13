import type { GetPromptResult, McpServer } from '@modelcontextprotocol/server';
import { z } from 'zod';
import { FREE_PLAN_RETENTION_DAYS } from '../utils/retention';

const setupHint = `First find out which project the user means: if they have several projects and it's unclear, call list_projects and ask them. Then call get_project with its projectId to learn today's date and the project's plan. If the plan doesn't include the data needed for a comparison (the Free plan only covers the last ${FREE_PLAN_RETENTION_DAYS} days), work with what it includes and say what's missing instead of running into errors.`;

function prompt(text: string): GetPromptResult {
  return {
    messages: [{ role: 'user', content: { type: 'text', text: `${text}\n\n${setupHint}` } }],
  };
}

export function registerPrompts(server: McpServer) {
  server.registerPrompt(
    'period_report',
    {
      title: 'Period report',
      description: 'Report on the last week or month compared with the one before.',
      argsSchema: z.object({
        period: z.enum(['week', 'month']).describe('The period to report on: "week" or "month".'),
      }),
    },
    ({ period }) =>
      prompt(
        `Write a report on my Vemetric analytics for the last ${period}, compared with the ${period} before. Use custom date ranges for both periods. Include users and pageviews with their change in %, the top pages, the top sources (referrers and UTM campaigns), the top countries, notable custom events and how my funnels' conversion rates changed. Point out what changed the most and what might explain it. Keep it concise, with the numbers in small tables.`,
      ),
  );

  server.registerPrompt(
    'investigate_change',
    {
      title: 'Investigate a change',
      description: 'Find out what explains a drop or spike of a metric on a day.',
      argsSchema: z.object({
        metric: z.string().describe('The metric that changed, e.g. users, pageviews, bounce rate or a custom event.'),
        date: z.string().describe('The day of the change, as YYYY-MM-DD.'),
      }),
    },
    ({ metric, date }) =>
      prompt(
        `${metric} changed noticeably on ${date}. Find out what explains it. First compare the day with the days before (daily values with groupBy "interval:day" from 4 weeks before the day to a few days after it) to confirm the change and its size. Then break the day down by referrer, country, page and device type, compare each breakdown with normal days and find the segments that account for the change. End with a short explanation of the most likely cause and the numbers that support it.`,
      ),
  );

  server.registerPrompt(
    'funnel_analysis',
    {
      title: 'Funnel analysis',
      description: 'Where people drop off in a funnel and which segments convert better or worse.',
      argsSchema: z.object({
        funnel: z.string().describe('Name or id of the funnel.'),
      }),
    },
    ({ funnel }) =>
      prompt(
        `Analyze my funnel "${funnel}" (find it with list_funnels) over the last 30 days. Show the users per step and where most people drop off. Then compare the conversion of segments by running get_funnel_results with filters for the top countries, device types, referrers and UTM campaigns (find their values with list_filter_values or query_analytics first). Point out the segments that convert clearly better or worse than average, and suggest what to look into.`,
      ),
  );

  server.registerPrompt(
    'conversion_sources',
    {
      title: 'Conversion sources',
      description: 'Which sources, campaigns and landing pages bring the most conversions for an event.',
      argsSchema: z.object({
        event: z.string().describe('Name of the custom event that counts as a conversion, e.g. signup.'),
      }),
    },
    ({ event }) =>
      prompt(
        `Find out which sources bring the most "${event}" conversions over the last 30 days, not just the most traffic. Check the exact event name with list_filter_values (field "event:name") first. Then count the converting users by their first-touch source: query_analytics with the metric "users" and an event filter for "${event}", grouped by firstVisit:referrer, firstVisit:utmSource and firstVisit:utmCampaign (where each user came from on their first visit ever, so every converting user counts for exactly one source). Compare with all users per first-touch source (the same queries without the event filter) to get a conversion rate per source. Only identified users have a first visit: "" holds anonymous users and users who came without a referrer or campaign, so leave it out of the conversion rates and just say how many converting users it has. Also find the entry pages whose visitors convert best (grouped by firstVisit:page:path, with and without the event filter). Don't count the events per source: events are credited to the source of the visit they happen in, which is often a later direct visit. Show the results in small tables and point out sources with many visitors but few conversions, and the other way around.`,
      ),
  );

  server.registerPrompt(
    'user_journey',
    {
      title: 'User journey',
      description: "Summarize one user's activity, e.g. for support or sales.",
      argsSchema: z.object({
        user: z
          .string()
          .describe(
            "The user's identifier, i.e. the id your website or app uses for the user (e.g. their id in your database), their Vemetric user id, or their name.",
          ),
      }),
    },
    ({ user }) =>
      prompt(
        `Summarize the journey of the user "${user}". Look them up with get_user by identifier, and if that finds nobody and it's a number, by id. If that finds nobody either, search for them with list_users (search "${user}") over the longest period the plan includes, and ask me which one I mean if several users match. Then get their events with get_user_events over the longest period the plan includes. Tell me where they are from, when they were first and last seen, how often they visited, which pages they viewed most and which key custom events they triggered and when. Keep it short and factual.`,
      ),
  );
}
