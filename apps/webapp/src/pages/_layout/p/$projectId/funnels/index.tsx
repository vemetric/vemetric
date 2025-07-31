import { AspectRatio, Box, Button, Card, Flex, Icon, SimpleGrid, Skeleton } from '@chakra-ui/react';
import { createFileRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { TIME_SPANS } from '@vemetric/common/charts/timespans';
import { TbChartFunnel, TbPlus } from 'react-icons/tb';
import { z } from 'zod';
import { CrispLink } from '@/components/crisp-link';
import { FilterContextProvider } from '@/components/filter/filter-context';
import { PageDotBackground } from '@/components/page-dot-background';
import { FunnelCard } from '@/components/pages/funnels/funnel-card';
import { FunnelDialog } from '@/components/pages/funnels/funnel-dialog';
import { TimespanSelect } from '@/components/timespan-select';
import { EmptyState } from '@/components/ui/empty-state';
import { useSetBreadcrumbs } from '@/stores/header-store';
import { trpc } from '@/utils/trpc';

const searchSchema = z.object({
  t: z.enum(TIME_SPANS).optional(),
});

export const Route = createFileRoute('/_layout/p/$projectId/funnels/')({
  validateSearch: zodValidator(searchSchema),
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId } = Route.useParams();

  const { data: filterableData } = trpc.filters.getFilterableData.useQuery({
    projectId,
    timespan: '3months',
  });

  const {
    data: funnelsData,
    isLoading,
    isError,
  } = trpc.funnels.list.useQuery({
    projectId,
  });

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
          <FunnelDialog>
            <Button variant="surface" size={{ base: 'xs', md: 'sm' }}>
              <Icon as={TbPlus} />
              New funnel
            </Button>
          </FunnelDialog>
          <TimespanSelect from="/_layout/p/$projectId/funnels/" />
        </Flex>
        {isError ? (
          <Card.Root py={6}>
            <EmptyState
              icon={<TbChartFunnel />}
              title="Error loading funnels"
              description={
                <>
                  Please <CrispLink>reach out</CrispLink> if this problem persists.
                </>
              }
            />
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
                  return <FunnelCard key={funnel.id} projectId={projectId} funnel={funnel} />;
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
                  >
                    <Card.Body pos="relative">
                      <AspectRatio ratio={16 / 9}>
                        <Box />
                      </AspectRatio>
                      <Flex pos="absolute" inset={0} justify="center" align="center">
                        <EmptyState icon={<TbChartFunnel />} title="Create a new funnel" />
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
    </FilterContextProvider>
  );
}
