import { Text, AspectRatio, Button, Box, Flex, SimpleGrid, Link, HStack, LinkOverlay } from '@chakra-ui/react';
import { createFileRoute, Navigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { getTimespanRefetchInterval } from '@vemetric/common/charts/timespans';
import { filterConfigSchema } from '@vemetric/common/filters';
import { sourcesSchema } from '@vemetric/common/sources';
import { z } from 'zod';
import { AddFilterButton } from '@/components/filter/add-filter/add-filter-button';
import { FilterContainer } from '@/components/filter/filter-container';
import { FilterContextProvider } from '@/components/filter/filter-context';
import { FilterSkeletons } from '@/components/filter/filter-skeletons';
import { LoadingImage } from '@/components/loading-image';
import { Logo } from '@/components/logo';
import { PageWrapper } from '@/components/page-wrapper';
import { BrowsersCard } from '@/components/pages/dashboard/browsers-card';
import { CountriesCard } from '@/components/pages/dashboard/countries-card';
import { DashboardChart } from '@/components/pages/dashboard/dashboard-chart';
import { DevicesCard } from '@/components/pages/dashboard/devices-card';
import { EventsCard } from '@/components/pages/dashboard/events/events-card';
import { FunnelsCard } from '@/components/pages/dashboard/funnels/funnels-card';
import { MostVisitedPagesCard } from '@/components/pages/dashboard/most-visited-pages-card';
import { OperatingSystemsCard } from '@/components/pages/dashboard/os-card';
import { TopSourcesCard } from '@/components/pages/dashboard/top-sources-card';
import { ThemeSwitch } from '@/components/theme-switch';
import { TimespanSelect } from '@/components/timespan-select';
import { Skeleton } from '@/components/ui/skeleton';
import { ProjectProvider } from '@/contexts/project-context';
import { getFaviconUrl } from '@/utils/favicon';
import { timeSpanSearchMiddleware, timespanSearchSchema } from '@/utils/timespans';
import { trpc } from '@/utils/trpc';

const dashboardSearchSchema = z.object({
  ...timespanSearchSchema.shape,
  f: filterConfigSchema,
  s: sourcesSchema,
  c: z.enum(['map', 'list']).optional(),
  u: z.enum(['browsers', 'devices', 'os']).optional(),
  e: z.boolean().optional(),
  se: z.string().optional(), // selected event to show properties for
  ep: z.string().optional(), // selected event property to show values for
  sf: z.string().optional(), // selected funnel to show steps for
  fu: z.boolean().optional(), // show active users in funnels (vs first step users)
});

export const Route = createFileRoute('/public/$domain')({
  validateSearch: zodValidator(dashboardSearchSchema),
  search: {
    middlewares: [timeSpanSearchMiddleware],
  },
  component: Page,
});

function Page() {
  const { domain } = Route.useParams();
  const { t: timespan = '24hrs', sd: startDate, ed: endDate, f: filterConfig, u: userType } = Route.useSearch();

  const { data, error, isPreviousData } = trpc.dashboard.getData.useQuery(
    { domain, timespan, startDate, endDate, filterConfig },
    { keepPreviousData: true, onError: () => {}, refetchInterval: getTimespanRefetchInterval(timespan) },
  );
  const { data: filterableData, isLoading: isFilterableDataLoading } = trpc.filters.getFilterableData.useQuery(
    {
      domain,
      timespan,
      startDate,
      endDate,
    },
    {
      refetchInterval: getTimespanRefetchInterval(timespan),
    },
  );

  if (error?.data?.httpStatus === 403) {
    return <Navigate to="/" />;
  }

  return (
    <ProjectProvider>
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
        <PageWrapper maxW="1000px" flexDir="column" px={{ base: 2, md: 5 }} pt={{ base: 2, md: 4 }}>
          <Flex align="center" justify="space-between" mb={4}>
            <Flex justify="center">
              <Link href={`https://vemetric.com?utm_source=public-dashboard&utm_campaign=${domain}`}>
                <Logo asLink={false} h={{ base: '32px', md: '44px' }} />
              </Link>
            </Flex>
            <Flex align="center" gap="4">
              <Flex align="center" gap="4" hideBelow="md">
                <ThemeSwitch />
                <Box w="1px" h="20px" bg="border.emphasized" />
              </Flex>
              <Link href="https://app.vemetric.com/signup" _hover={{ textDecoration: 'none' }}>
                <Button size={{ base: 'xs', md: 'sm' }} colorPalette="purple">
                  Start tracking
                </Button>
              </Link>
            </Flex>
          </Flex>
          {data ? (
            <>
              <Box pos="sticky" top={0} zIndex="dropdown">
                {isFilterableDataLoading ? (
                  <Box pt={3}>
                    <FilterSkeletons loading />
                  </Box>
                ) : (
                  <Flex
                    pt={2}
                    gap={{ base: 3, md: 2 }}
                    bg="bg.muted"
                    flexWrap="wrap"
                    align={filterConfig ? 'start' : 'center'}
                    flexDir={filterConfig ? 'column' : 'row'}
                  >
                    <HStack gap={{ base: 1.5, md: 2 }} pos="relative">
                      <LoadingImage
                        src={getFaviconUrl(domain, 256)}
                        boxSize={{ base: 6, md: 8 }}
                        overflow="hidden"
                        rounded="md"
                      />
                      <Text textStyle={['xs', 'sm']} fontWeight="semibold" truncate>
                        <LinkOverlay asChild>
                          <Link href={'https://' + domain} target="_blank">
                            {data?.projectName}
                          </Link>
                        </LinkOverlay>
                      </Text>
                    </HStack>
                    <Flex
                      flexWrap="wrap"
                      flexGrow={1}
                      w={filterConfig ? '100%' : 'auto'}
                      columnGap={8}
                      rowGap={4}
                      align="center"
                    >
                      <FilterContainer filterConfig={filterConfig} from="/public/$domain" />
                      <Flex flexGrow={1} gap={2.5} justify="flex-end">
                        <AddFilterButton from="/public/$domain" filterConfig={filterConfig} />
                        <TimespanSelect from="/public/$domain" />
                      </Flex>
                    </Flex>
                  </Flex>
                )}
                <Box
                  h={5}
                  w="full"
                  bg="linear-gradient(to bottom, var(--chakra-colors-bg-muted) 20%, rgba(0, 0, 0, 0) 100%)"
                />
              </Box>
              <Flex mt={-2} flexDir="column" gap={3} pos="relative">
                <Box pos="relative">
                  <DashboardChart
                    timespan={timespan}
                    timespanStartDate={startDate}
                    timespanEndDate={endDate}
                    data={data}
                    publicDashboard
                  />
                  {isPreviousData && (
                    <Box pos="absolute" inset="0" opacity="0.8" zIndex="docked">
                      <Skeleton pos="absolute" inset="0" rounded="lg" />
                    </Box>
                  )}
                </Box>
                <SimpleGrid columns={[1, 1, 2]} gap={3}>
                  <MostVisitedPagesCard
                    filterConfig={filterConfig}
                    projectDomain={data?.projectDomain ?? ''}
                    publicDashboard
                  />
                  <TopSourcesCard filterConfig={filterConfig} publicDashboard />
                  <EventsCard filterConfig={filterConfig} publicDashboard />
                  <CountriesCard filterConfig={filterConfig} publicDashboard />
                  <FunnelsCard filterConfig={filterConfig} publicDashboard activeUsers={data.users ?? 0} />
                  {userType === 'os' ? (
                    <OperatingSystemsCard filterConfig={filterConfig} publicDashboard />
                  ) : userType === 'devices' ? (
                    <DevicesCard filterConfig={filterConfig} publicDashboard />
                  ) : (
                    <BrowsersCard filterConfig={filterConfig} publicDashboard />
                  )}
                </SimpleGrid>
              </Flex>
            </>
          ) : (
            <Flex flexDir="column" gap={3}>
              <FilterSkeletons loading />
              <AspectRatio ratio={16 / 7}>
                <Skeleton height="full" width="full" loading />
              </AspectRatio>
              <SimpleGrid columns={[1, 1, 2]} gap={3}>
                <Skeleton height="300px" w="full" loading />
                <Skeleton height="300px" w="full" loading />
                <Skeleton height="300px" w="full" loading />
                <Skeleton height="300px" w="full" loading />
              </SimpleGrid>
            </Flex>
          )}
          <Flex mt={12} mb={6} flexDir="column" align="center" justify="center" gap={2}>
            <Link href={`https://vemetric.com?utm_source=public-dashboard&utm_campaign=${domain}`}>
              <Logo asLink={false} h={{ base: '32px', md: '38px' }} />
            </Link>
            <Text fontSize="sm">
              <Link
                href={`https://app.vemetric.com/signup?utm_source=public-dashboard&utm_campaign=${domain}`}
                fontWeight="medium"
                color="purple.fg"
              >
                Sign up
              </Link>{' '}
              and start tracking.
            </Text>
          </Flex>
        </PageWrapper>
      </FilterContextProvider>
    </ProjectProvider>
  );
}
