import { Box, Button, Flex, Icon, IconButton, LinkOverlay, useBreakpointValue } from '@chakra-ui/react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { TIME_SPANS } from '@vemetric/common/charts/timespans';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { TbChartBarPopular, TbEdit, TbTrash } from 'react-icons/tb';
import { z } from 'zod';
import { DeletePopover } from '@/components/delete-popover';
import { FilterContextProvider } from '@/components/filter/filter-context';
import { PageDotBackground } from '@/components/page-dot-background';
import { FunnelDialog } from '@/components/pages/funnels/funnel-dialog';
import { HorizontalFunnel } from '@/components/pages/funnels/horizontal-funnel';
import { VerticalFunnel } from '@/components/pages/funnels/vertical-funnel';
import { TimespanSelect } from '@/components/timespan-select';
import { useSetBreadcrumbs } from '@/stores/header-store';
import { trpc } from '@/utils/trpc';

const searchSchema = z.object({
  t: z.enum(TIME_SPANS).optional(),
});

export const Route = createFileRoute('/_layout/p/$projectId/funnels/$funnelId')({
  validateSearch: zodValidator(searchSchema),
  component: RouteComponent,
});

type FunnelStep = {
  users: number;
};

const funnelSteps: FunnelStep[] = [
  { users: 1001 },
  { users: 750 },
  { users: 400 },
  { users: 250 },
  { users: 240 },
  { users: 240 },
];

function RouteComponent() {
  const navigate = useNavigate();
  const { projectId, funnelId } = Route.useParams();
  const activeUsersButtonRef = useRef<HTMLDivElement>(null);
  const [horizontalFunnel, setHorizontalFunnel] = useState(true);
  const [activeUsersVisible, setActiveUsersVisible] = useState(false);
  const isMobile = useBreakpointValue({ base: true, md: false });

  const utils = trpc.useUtils();

  const { data: filterableData } = trpc.filters.getFilterableData.useQuery({
    projectId,
    timespan: '3months',
  });

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
    funnelId,
  ]);

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
          <Flex ref={activeUsersButtonRef} pos="relative" align="center" h="32px" />
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
              <DeletePopover onDelete={() => deleteFunnel({ projectId, id: funnelId })} isLoading={isFunnelDeleting}>
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
              <HorizontalFunnel
                activeUsersButtonRef={activeUsersButtonRef}
                funnelSteps={funnelSteps}
                activeUsersVisible={activeUsersVisible}
                setActiveUsersVisible={setActiveUsersVisible}
              />
            </motion.div>
          ) : (
            <motion.div
              key="vertical-funnel"
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 50 }}
              transition={{ duration: 0.2 }}
            >
              <VerticalFunnel
                activeUsersButtonRef={activeUsersButtonRef}
                funnelSteps={funnelSteps}
                activeUsersVisible={activeUsersVisible}
                setActiveUsersVisible={setActiveUsersVisible}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </Box>
    </FilterContextProvider>
  );
}
