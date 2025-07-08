import { AspectRatio, Button, Box, Flex, SimpleGrid } from '@chakra-ui/react';
import { createFileRoute, Navigate, useNavigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import type { TimeSpan } from '@vemetric/common/charts/timespans';
import { TIME_SPAN_DATA, TIME_SPANS } from '@vemetric/common/charts/timespans';
import { filterConfigSchema } from '@vemetric/common/filters';
import { sourcesSchema } from '@vemetric/common/sources';
import { TbClock } from 'react-icons/tb';
import { z } from 'zod';
import { AddFilterButton } from '@/components/filter/add-filter/add-filter-button';
import { FilterContainer } from '@/components/filter/filter-container';
import { FilterContextProvider } from '@/components/filter/filter-context';
import { BrowsersCard } from '@/components/pages/dashboard/browsers-card';
import { CountriesCard } from '@/components/pages/dashboard/countries-card';
import { DashboardChart } from '@/components/pages/dashboard/dashboard-chart';
import { DevicesCard } from '@/components/pages/dashboard/devices-card';
import { EventsCard } from '@/components/pages/dashboard/events/events-card';
import { MostVisitedPagesCard } from '@/components/pages/dashboard/most-visited-pages-card';
import { OperatingSystemsCard } from '@/components/pages/dashboard/os-card';
import { TopSourcesCard } from '@/components/pages/dashboard/top-sources-card';
import { ProjectInitCard } from '@/components/project-init-card';
import { MenuContent, MenuRadioItem, MenuRadioItemGroup, MenuRoot, MenuTrigger } from '@/components/ui/menu';
import { Skeleton } from '@/components/ui/skeleton';
import { Tooltip } from '@/components/ui/tooltip';
import { useTimespanParam } from '@/hooks/use-timespan-param';
import { useSetBreadcrumbs, useSetDocsLink } from '@/stores/header-store';
import { trpc } from '@/utils/trpc';

const TopRowSkeletons = ({ loading }: { loading: boolean }) => (
  <Flex>
    <Flex gap={3}>
      <Skeleton height={9} width="100px" loading={loading} />
      <Skeleton height={9} width="100px" loading={loading} />
      <Skeleton height={9} width="100px" loading={loading} />
      <Skeleton height={9} width="100px" loading={loading} />
    </Flex>
    <Box flexGrow={1} />
    <Skeleton height={9} width="144px" loading={loading} />
  </Flex>
);

const dashboardSearchSchema = z.object({
  t: z.enum(TIME_SPANS).optional(),
  f: filterConfigSchema,
  s: sourcesSchema,
  u: z.enum(['countries', 'browsers', 'devices', 'os']).optional(),
  e: z.boolean().optional(), // show events in the chart
  se: z.string().optional(), // selected event to show properties for
  ep: z.string().optional(), // selected event property to show values for
});

export const Route = createFileRoute('/_layout/p/$projectId/')({
  validateSearch: zodValidator(dashboardSearchSchema),
  component: Page,
});

function Page() {
  const navigate = useNavigate({ from: Route.fullPath });
  const { projectId } = Route.useParams();
  const { f: filterConfig, u: userType } = Route.useSearch();
  const { timespan } = useTimespanParam({ publicDashboard: false });

  const { data, error, isPreviousData, isLoading } = trpc.dashboard.getData.useQuery(
    { projectId, timespan, filterConfig },
    { keepPreviousData: true, onError: () => {} },
  );
  const { data: filterableData, isLoading: isFilterableDataLoading } = trpc.filters.getFilterableData.useQuery({
    projectId,
    timespan,
  });

  const timeSpanData = TIME_SPAN_DATA[timespan];
  useSetBreadcrumbs(['Dashboard']);
  useSetDocsLink(
    data && data.isInitialized === false
      ? 'https://vemetric.com/docs/installation'
      : 'https://vemetric.com/docs/dashboard',
  );

  if (!isLoading && !data?.isSubscriptionActive) {
    if (timespan === '3months' || timespan === '6months' || timespan === '1year') {
      return <Navigate from={Route.fullPath} search={{ t: '30days' }} replace />;
    }
  }

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
        }}
      >
        {data?.isInitialized ? (
          <>
            <Box mt={-3} pos="sticky" top={{ base: '44px', md: '122px', lg: '52px' }} zIndex="dropdown">
              {isFilterableDataLoading ? (
                <Box pt={3}>
                  <TopRowSkeletons loading />
                </Box>
              ) : (
                <Flex pt={3} bg="bg.content" flexWrap="wrap" w="100%" columnGap={8} rowGap={4} align="center">
                  <FilterContainer filterConfig={filterConfig} from="/p/$projectId" />
                  <Flex flexGrow={1} gap={2.5} justify="flex-end">
                    <AddFilterButton from="/p/$projectId" filterConfig={filterConfig} />
                    <MenuRoot positioning={{ placement: 'bottom-end' }}>
                      <MenuTrigger asChild>
                        <Button variant="surface" size={{ base: 'xs', md: 'sm' }}>
                          <TbClock /> {timeSpanData.label}
                        </Button>
                      </MenuTrigger>
                      <MenuContent minW="10rem">
                        <MenuRadioItemGroup
                          value={timespan}
                          onValueChange={({ value }) => {
                            navigate({
                              resetScroll: false,
                              search: (prev) => ({ ...prev, t: String(value) as TimeSpan }),
                            });
                          }}
                        >
                          {Object.entries(TIME_SPAN_DATA).map(([key, value]) => {
                            const isDisabled =
                              !data?.isSubscriptionActive &&
                              (key === '3months' || key === '6months' || key === '1year');

                            return (
                              <Tooltip
                                key={key}
                                contentProps={{ maxW: '230px' }}
                                content="Upgrade to the Professional plan for longer data retention."
                                disabled={!isDisabled}
                              >
                                <MenuRadioItem value={key} disabled={isDisabled}>
                                  {value.label}
                                </MenuRadioItem>
                              </Tooltip>
                            );
                          })}
                        </MenuRadioItemGroup>
                      </MenuContent>
                    </MenuRoot>
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
                <DashboardChart timespan={timespan} data={data} />
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
                {userType === 'browsers' ? (
                  <BrowsersCard filterConfig={filterConfig} />
                ) : userType === 'devices' ? (
                  <DevicesCard filterConfig={filterConfig} />
                ) : userType === 'os' ? (
                  <OperatingSystemsCard filterConfig={filterConfig} />
                ) : (
                  <CountriesCard filterConfig={filterConfig} />
                )}
              </SimpleGrid>
            </Flex>
          </>
        ) : (
          <Flex flexDir="column" gap={3}>
            <TopRowSkeletons loading={data?.isInitialized !== false} />
            <AspectRatio ratio={16 / 7}>
              <Skeleton height="full" width="full" loading={data?.isInitialized !== false} />
            </AspectRatio>
            <SimpleGrid columns={[1, 1, 2]} gap={3}>
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
