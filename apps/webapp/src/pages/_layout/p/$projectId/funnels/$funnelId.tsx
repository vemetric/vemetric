import { Box, Button, Card, Flex, Icon, IconButton, LinkOverlay, Skeleton, useBreakpointValue } from '@chakra-ui/react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { TIME_SPANS } from '@vemetric/common/charts/timespans';
import { AnimatePresence, motion } from 'motion/react';
import React, { useState } from 'react';
import { TbChartBarPopular, TbEdit, TbTrash } from 'react-icons/tb';
import { z } from 'zod';
import { DeletePopover } from '@/components/delete-popover';
import { FilterContextProvider } from '@/components/filter/filter-context';
import { PageDotBackground } from '@/components/page-dot-background';
import { ActiveUsersButton } from '@/components/pages/funnels/active-users-button';
import { FunnelDialog } from '@/components/pages/funnels/funnel-dialog';
import { FunnelSkeleton } from '@/components/pages/funnels/funnel-skeleton';
import { HorizontalFunnel } from '@/components/pages/funnels/horizontal-funnel';
import { VerticalFunnel } from '@/components/pages/funnels/vertical-funnel';
import { TimespanSelect } from '@/components/timespan-select';
import { ErrorState } from '@/components/ui/empty-state';
import { useActiveUsersParam } from '@/hooks/use-activeusers-param';
import { useTimespanParam } from '@/hooks/use-timespan-param';
import { useSetBreadcrumbs } from '@/stores/header-store';
import { trpc } from '@/utils/trpc';

const searchSchema = z.object({
  t: z.enum(TIME_SPANS).optional(),
  u: z.boolean().optional(),
});

export const Route = createFileRoute('/_layout/p/$projectId/funnels/$funnelId')({
  validateSearch: zodValidator(searchSchema),
  component: RouteComponent,
});

function RouteComponent() {
  const navigate = Route.useNavigate();
  const { projectId, funnelId } = Route.useParams();
  const { timespan } = useTimespanParam({ from: '/_layout/p/$projectId/funnels/$funnelId' });
  const { activeUsersVisible, setActiveUsersVisible } = useActiveUsersParam({
    from: '/_layout/p/$projectId/funnels/$funnelId',
  });
  const [horizontalFunnel, setHorizontalFunnel] = useState(true);
  const isMobile = useBreakpointValue({ base: true, md: false });

  const utils = trpc.useUtils();

  const { data: filterableData } = trpc.filters.getFilterableData.useQuery({
    projectId,
    timespan,
  });

  const {
    data: funnelData,
    isError: isFunnelError,
    isLoading: _isFunnelLoading,
  } = trpc.funnels.get.useQuery({
    projectId,
    id: funnelId,
  });
  const isFunnelLoading = _isFunnelLoading || !funnelData;

  const {
    data: funnelResults,
    isError: isResultsError,
    isLoading: _isResultsLoading,
  } = trpc.funnels.getFunnelResults.useQuery({
    projectId,
    timespan,
    id: funnelId,
  });
  const isResultsLoading = _isResultsLoading || !funnelResults;

  // merge steps and results data
  const funnelSteps = React.useMemo(() => {
    if (isFunnelLoading || isResultsLoading) {
      return null;
    }

    const results = funnelResults.funnelResults;
    const funnelStepsData = funnelData.funnel.steps as Array<{ name: string; [key: string]: any }>;
    const activeUsers = funnelResults.activeUsers || 0;

    // Create array with users count for each stage
    const stepResults = [];

    // First entry: total active users
    stepResults.push({ name: 'Active Users', users: activeUsers });

    // Add users for each completed step with custom names
    for (let i = 0; i < funnelStepsData.length; i++) {
      const stageResult = results[i];
      const stepData = funnelStepsData[i];
      const stepName = stepData?.name || `Step ${i + 1}`;
      stepResults.push({
        name: stepName,
        users: stageResult?.userCount || 0,
      });
    }

    return stepResults;
  }, [isFunnelLoading, isResultsLoading, funnelResults, funnelData]);

  const { mutate: deleteFunnel, isLoading: isFunnelDeleting } = trpc.funnels.delete.useMutation({
    onSuccess: async () => {
      await utils.funnels.list.refetch();
      navigate({ to: '/p/$projectId/funnels', params: { projectId } });
    },
  });

  useSetBreadcrumbs([
    <LinkOverlay key="funnels" asChild>
      <Link to="/p/$projectId/funnels" params={{ projectId }}>
        Funnels
      </Link>
    </LinkOverlay>,
    isFunnelLoading ? (
      <Skeleton key="funnel-name" w="100px" h="20px" rounded="md" />
    ) : (
      funnelData?.funnel?.name || funnelId
    ),
  ]);

  if (isFunnelError || isResultsError) {
    return (
      <>
        <PageDotBackground />
        <Flex justify="center">
          <Card.Root minW="400px">
            <ErrorState title="Error loading funnel data" />
          </Card.Root>
        </Flex>
      </>
    );
  }

  if (isFunnelLoading || isResultsLoading || !funnelSteps) {
    return (
      <>
        <PageDotBackground />
        <FunnelSkeleton />
      </>
    );
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
      <PageDotBackground />
      <Box pos="relative" maxW="100%">
        <Flex pos="relative" mb={6} align="center" gap={2} zIndex="1">
          <Flex pos="relative" align="center" h="32px">
            <ActiveUsersButton
              activeUsers={funnelResults.activeUsers || 0}
              activeUsersVisible={activeUsersVisible}
              setActiveUsersVisible={setActiveUsersVisible}
            />
          </Flex>
          <Flex flexGrow={1} justify="center" align="center">
            {!isMobile && (
              <Button variant="surface" size="xs" onClick={() => setHorizontalFunnel((value) => !value)}>
                <Icon as={TbChartBarPopular} transform={horizontalFunnel ? 'scaleX(-1)' : 'scaleY(-1) rotate(90deg)'} />{' '}
                {horizontalFunnel ? 'Horizontal' : 'Vertical'}
              </Button>
            )}
          </Flex>
          <Flex align="center" gap={3}>
            <Flex align="center" gap={2.5}>
              <FunnelDialog funnelId={funnelId}>
                <IconButton variant="surface" size="xs">
                  <Icon as={TbEdit} />
                </IconButton>
              </FunnelDialog>
              <DeletePopover
                text="Do you really want to delete this funnel?"
                onDelete={() => deleteFunnel({ projectId, id: funnelId })}
                isLoading={isFunnelDeleting}
              >
                <IconButton variant="surface" size="xs" color="red.fg">
                  <Icon as={TbTrash} />
                </IconButton>
              </DeletePopover>
            </Flex>
            <Box w="1px" h="26px" bg="gray.muted" />
            <TimespanSelect from="/_layout/p/$projectId/funnels/$funnelId" />
          </Flex>
        </Flex>
        <AnimatePresence mode="popLayout" initial={false}>
          {horizontalFunnel && !isMobile ? (
            <motion.div
              key="horizontal-funnel"
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ duration: 0.2 }}
            >
              <HorizontalFunnel funnelSteps={funnelSteps} activeUsersVisible={activeUsersVisible} />
            </motion.div>
          ) : (
            <motion.div
              key="vertical-funnel"
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ duration: 0.2 }}
            >
              <VerticalFunnel funnelSteps={funnelSteps} activeUsersVisible={activeUsersVisible} />
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </FilterContextProvider>
  );
}
