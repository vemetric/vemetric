import { AspectRatio, Box, Flex, SimpleGrid } from '@chakra-ui/react';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { getTimespanRefetchInterval } from '@vemetric/common/charts/timespans';
import { filterConfigSchema } from '@vemetric/common/filters';
import { sourcesSchema } from '@vemetric/common/sources';
import { z } from 'zod';
import { AddFilterButton } from '~/components/filter/add-filter/add-filter-button';
import { FilterContainer } from '~/components/filter/filter-container';
import { FilterContextProvider } from '~/components/filter/filter-context';
import { FilterSkeletons } from '~/components/filter/filter-skeletons';
import { BrowsersCard } from '~/components/pages/dashboard/browsers-card';
import { CountriesCard } from '~/components/pages/dashboard/countries-card';
import { DashboardChart } from '~/components/pages/dashboard/dashboard-chart';
import { DevicesCard } from '~/components/pages/dashboard/devices-card';
import { EventsCard } from '~/components/pages/dashboard/events/events-card';
import { FunnelsCard } from '~/components/pages/dashboard/funnels/funnels-card';
import { MostVisitedPagesCard } from '~/components/pages/dashboard/most-visited-pages-card';
import { OperatingSystemsCard } from '~/components/pages/dashboard/os-card';
import { TopSourcesCard } from '~/components/pages/dashboard/top-sources-card';
import { ProjectInitCard } from '~/components/project-init-card';
import { TimespanSelect } from '~/components/timespan-select';
import { Skeleton } from '~/components/ui/skeleton';
import { chartTogglesSchema } from '~/hooks/use-chart-toggles';
import { useTimespanParam } from '~/hooks/use-timespan-param';
import { useSetBreadcrumbs, useSetDocsLink } from '~/stores/header-store';
import { timeSpanSearchMiddleware, timespanSearchSchema } from '~/utils/timespans';
import { useTrendsData } from '~/utils/trends';
import { trpc } from '~/utils/trpc';

const dashboardSearchSchema = z.object({
  ...timespanSearchSchema.shape,
  f: filterConfigSchema,
  s: sourcesSchema,
  c: z.enum(['map', 'list']).optional(),
  u: z.enum(['browsers', 'devices', 'os']).optional(),
  ch: chartTogglesSchema, // visible chart categories (default: ['users', 'pageViews'])
  me: z // selected event in the dashboard events card
    .object({
      n: z.string(), // event name
      p: z.string().optional(), // selected event property to show values for
    })
    .optional(),
  sf: z.string().optional(), // selected funnel to show steps for
  fu: z.boolean().optional(), // show active users in funnels (vs first step users)
});

export const Route = createFileRoute('/_layout/p/$projectId/')({
  validateSearch: zodValidator(dashboardSearchSchema),
  search: {
    middlewares: [timeSpanSearchMiddleware],
  },
  component: Page,
});

function Page() {
  const { projectId } = Route.useParams();
  const { f: filterConfig, u: userType } = Route.useSearch();
  const { timespan, startDate, endDate } = useTimespanParam({ from: '/_layout/p/$projectId/' });

  const { data, error, isPreviousData } = trpc.dashboard.getData.useQuery(
    { projectId, timespan, startDate, endDate, filterConfig },
    {
      keepPreviousData: true,
      onError: () => {},
      refetchInterval: getTimespanRefetchInterval(timespan),
      trpc: { context: { skipBatch: true } },
    },
  );
  const { data: previousData } = trpc.dashboard.getPreviousData.useQuery(
    { projectId, timespan, startDate, endDate, filterConfig },
    {
      onError: () => {},
      refetchInterval: getTimespanRefetchInterval(timespan),
      trpc: { context: { skipBatch: true } },
    },
  );
  const trendsData = useTrendsData(isPreviousData ? undefined : data, previousData);
  const { data: filterableData, isLoading: isFilterableDataLoading } = trpc.filters.getFilterableData.useQuery(
    {
      projectId,
      timespan,
      startDate,
      endDate,
    },
    {
      refetchInterval: getTimespanRefetchInterval(timespan),
    },
  );

  useSetBreadcrumbs(['Dashboard']);
  useSetDocsLink(
    data && data.isInitialized === false
      ? 'https://vemetric.com/docs/installation'
      : 'https://vemetric.com/docs/dashboard',
  );

  if (error?.data?.httpStatus === 403) {
    return <Navigate to="/" />;
  }

  return (
    <FilterContextProvider
      value={{
        pagePaths: filterableData?.pagePaths ?? [],
        origins: filterableData?.origins ?? [],
        eventNames: filterableData?.eventNames ?? [],
        countryCodes: filterableData?.countryCodes ?? [],
        referrers: filterableData?.referrers ?? [],
        referrerUrls: filterableData?.referrerUrls ?? [],
        utmCampaigns: filterableData?.utmCampaigns ?? [],
        utmContents: filterableData?.utmContents ?? [],
        utmMediums: filterableData?.utmMediums ?? [],
        utmSources: filterableData?.utmSources ?? [],
        utmTerms: filterableData?.utmTerms ?? [],
        browserNames: filterableData?.browserNames ?? [],
        deviceTypes: filterableData?.deviceTypes ?? [],
        osNames: filterableData?.osNames ?? [],
        funnels: filterableData?.funnels ?? [],
      }}
    >
      {data?.isInitialized ? (
        <>
          <Box mt={-3} pos="sticky" top={{ base: '44px', md: '122px', lg: '52px' }} zIndex="dropdown">
            {isFilterableDataLoading ? (
              <Box pt={3}>
                <FilterSkeletons loading />
              </Box>
            ) : (
              <Flex pt={3} bg="bg.content" flexWrap="wrap" w="100%" columnGap={8} rowGap={4} align="center">
                <FilterContainer filterConfig={filterConfig} from="/p/$projectId" />
                <Flex flexGrow={1} gap={2.5} justify="flex-end">
                  <AddFilterButton from="/p/$projectId" filterConfig={filterConfig} />
                  <TimespanSelect from="/_layout/p/$projectId/" />
                </Flex>
              </Flex>
            )}
            <Box
              h={3}
              w="full"
              bg="linear-gradient(to bottom, var(--chakra-colors-bg-content) 20%, rgba(0, 0, 0, 0) 100%)"
            />
          </Box>
          <Flex flexDir="column" gap={3} pos="relative">
            <Box pos="relative">
              <DashboardChart
                timespan={timespan}
                timespanStartDate={startDate}
                timespanEndDate={endDate}
                data={data}
                trends={trendsData}
              />
              {isPreviousData && (
                <Box pos="absolute" inset="0" opacity="0.8" zIndex="docked">
                  <Skeleton pos="absolute" inset="0" rounded="lg" />
                </Box>
              )}
            </Box>
            <SimpleGrid columns={[1, 1, 2]} gap={3}>
              <MostVisitedPagesCard filterConfig={filterConfig} projectDomain={data?.projectDomain ?? ''} />
              <TopSourcesCard filterConfig={filterConfig} />
              <EventsCard filterConfig={filterConfig} />
              <CountriesCard filterConfig={filterConfig} />
              <FunnelsCard filterConfig={filterConfig} activeUsers={data.users} />
              {userType === 'os' ? (
                <OperatingSystemsCard filterConfig={filterConfig} />
              ) : userType === 'devices' ? (
                <DevicesCard filterConfig={filterConfig} />
              ) : (
                <BrowsersCard filterConfig={filterConfig} />
              )}
            </SimpleGrid>
          </Flex>
        </>
      ) : (
        <Flex flexDir="column" gap={3}>
          <FilterSkeletons loading={data?.isInitialized !== false} />
          <AspectRatio ratio={16 / 7}>
            <Skeleton height="full" width="full" loading={data?.isInitialized !== false} />
          </AspectRatio>
          <SimpleGrid columns={[1, 1, 2]} gap={3}>
            <Skeleton height="300px" w="full" loading={data?.isInitialized !== false} />
            <Skeleton height="300px" w="full" loading={data?.isInitialized !== false} />
            <Skeleton height="300px" w="full" loading={data?.isInitialized !== false} />
            <Skeleton height="300px" w="full" loading={data?.isInitialized !== false} />
            <Skeleton height="300px" w="full" loading={data?.isInitialized !== false} />
          </SimpleGrid>
        </Flex>
      )}
      {data && data.isInitialized === false && <ProjectInitCard projectToken={data.projectToken} />}
    </FilterContextProvider>
  );
}
