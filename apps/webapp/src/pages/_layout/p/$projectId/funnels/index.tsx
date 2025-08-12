import { AspectRatio, Box, Button, Card, Flex, Icon, SimpleGrid, Skeleton } from '@chakra-ui/react';
import { createFileRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { TIME_SPANS } from '@vemetric/common/charts/timespans';
import { TbChartFunnel, TbPlus } from 'react-icons/tb';
import { z } from 'zod';
import { FilterContextProvider } from '@/components/filter/filter-context';
import { PageDotBackground } from '@/components/page-dot-background';
import { ActiveUsersButton } from '@/components/pages/funnels/active-users-button';
import { FunnelCard } from '@/components/pages/funnels/funnel-card';
import { FunnelDialog } from '@/components/pages/funnels/funnel-dialog';
import { TimespanSelect } from '@/components/timespan-select';
import { EmptyState, ErrorState } from '@/components/ui/empty-state';
import { useActiveUsersParam } from '@/hooks/use-activeusers-param';
import { useTimespanParam } from '@/hooks/use-timespan-param';
import { useSetBreadcrumbs } from '@/stores/header-store';
import { trpc } from '@/utils/trpc';

const searchSchema = z.object({
  t: z.enum(TIME_SPANS).optional(),
  u: z.boolean().optional(),
});

export const Route = createFileRoute('/_layout/p/$projectId/funnels/')({
  validateSearch: zodValidator(searchSchema),
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { timespan } = useTimespanParam({ from: '/_layout/p/$projectId/funnels/' });
  const { activeUsersVisible, setActiveUsersVisible } = useActiveUsersParam({ from: '/_layout/p/$projectId/funnels/' });

  const { data: filterableData } = trpc.filters.getFilterableData.useQuery({
    projectId,
    timespan,
  });

  const {
    data: funnelsData,
    isLoading,
    isError,
    isPreviousData,
  } = trpc.funnels.list.useQuery(
    {
      projectId,
      timespan,
    },
    { keepPreviousData: true },
  );

  useSetBreadcrumbs(['Funnels']);

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
      <PageDotBackground />
      <Box pos="relative" maxW="100%">
        <Flex pos="relative" mb={6} align="center" gap={2} justify="space-between">
          <Flex pos="relative" align="center" h="32px">
            <ActiveUsersButton
              activeUsers={funnelsData?.activeUsers ?? 0}
              activeUsersVisible={activeUsersVisible}
              setActiveUsersVisible={setActiveUsersVisible}
            />
          </Flex>
          <Flex align="center" gap={3}>
            <FunnelDialog>
              <Button variant="surface" size={{ base: 'xs', md: 'sm' }}>
                <Icon as={TbPlus} />
                New funnel
              </Button>
            </FunnelDialog>
            <Box w="1px" h="26px" bg="gray.muted" />
            <TimespanSelect from="/_layout/p/$projectId/funnels/" excludeLive />
          </Flex>
        </Flex>
        {isError ? (
          <Card.Root py={6}>
            <ErrorState title="Error loading funnels" />
          </Card.Root>
        ) : (
          <SimpleGrid columns={{ base: 1, md: 2, lg: 3 }} gap={5}>
            {isLoading ? (
              <>
                <AspectRatio ratio={16 / 9}>
                  <Skeleton rounded="xl" />
                </AspectRatio>
                <AspectRatio ratio={16 / 9}>
                  <Skeleton rounded="xl" />
                </AspectRatio>
                <AspectRatio ratio={16 / 9}>
                  <Skeleton rounded="xl" />
                </AspectRatio>
              </>
            ) : (
              <>
                {funnelsData?.funnels.map((funnel) => {
                  return (
                    <FunnelCard
                      key={funnel.id}
                      projectId={projectId}
                      funnel={funnel}
                      activeUsersVisible={activeUsersVisible}
                    />
                  );
                })}
                <FunnelDialog>
                  <Card.Root
                    as="button"
                    overflow="hidden"
                    rounded="xl"
                    borderStyle="dashed"
                    borderWidth="2px"
                    transition="all 0.2s ease-in-out"
                    _hover={{ bg: 'gray.subtle/50', borderColor: 'purple.500/50' }}
                    className="group"
                  >
                    <Card.Body pos="relative">
                      <AspectRatio ratio={16 / 9}>
                        <Box />
                      </AspectRatio>
                      <Flex pos="absolute" inset={0} justify="center" align="center">
                        <EmptyState
                          icon={
                            <Icon
                              as={TbChartFunnel}
                              transition="all 0.2s ease-in-out"
                              _groupHover={{ color: 'purple.500' }}
                            />
                          }
                          title="Create a new funnel"
                        />
                      </Flex>
                    </Card.Body>
                    <Box
                      pos="absolute"
                      right="-125px"
                      bottom="-125px"
                      w="220px"
                      h="220px"
                      border="12px solid"
                      borderColor="gray.emphasized"
                      bg="gray.emphasized/50"
                      rounded="full"
                      opacity="0.2"
                    />
                    <Box
                      pos="absolute"
                      left="-125px"
                      top="-125px"
                      w="220px"
                      h="220px"
                      border="12px solid"
                      borderColor="gray.emphasized"
                      bg="gray.emphasized/50"
                      rounded="full"
                      opacity="0.2"
                    />
                  </Card.Root>
                </FunnelDialog>
              </>
            )}
          </SimpleGrid>
        )}
      </Box>

      {isPreviousData && (
        <Box pos="absolute" inset="0" opacity="0.8" zIndex="docked">
          <Skeleton pos="absolute" inset="0" rounded="md" />
        </Box>
      )}
    </FilterContextProvider>
  );
}
