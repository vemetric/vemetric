import { Box, Button, Flex, Icon, LinkOverlay } from '@chakra-ui/react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { TIME_SPANS } from '@vemetric/common/charts/timespans';
import { AnimatePresence, motion } from 'motion/react';
import { useRef, useState } from 'react';
import { TbChartBarPopular } from 'react-icons/tb';
import { z } from 'zod';
import { PageDotBackground } from '@/components/page-dot-background';
import { HorizontalFunnel } from '@/components/pages/funnels/horizontal-funnel';
import { VerticalFunnel } from '@/components/pages/funnels/vertical-funnel';
import { TimespanSelect } from '@/components/timespan-select';
import { useSetBreadcrumbs } from '@/stores/header-store';

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

const funnelSteps: FunnelStep[] = [{ users: 1001 }, { users: 750 }, { users: 400 }, { users: 250 }, { users: 240 }];

function RouteComponent() {
  const { projectId, funnelId } = Route.useParams();
  const activeUsersButtonRef = useRef<HTMLDivElement>(null);
  const [horizontalFunnel, setHorizontalFunnel] = useState(true);
  const [activeUsersVisible, setActiveUsersVisible] = useState(false);

  useSetBreadcrumbs([
    <LinkOverlay key="funnels" asChild>
      <Link to="/p/$projectId/funnels" params={{ projectId }}>
        Funnels
      </Link>
    </LinkOverlay>,
    funnelId,
  ]);

  return (
    <>
      <PageDotBackground />
      <Box pos="relative" maxW="100%">
        <Flex pos="relative" mb={6} align="center" gap={2} justify="space-between" zIndex="1">
          <Flex ref={activeUsersButtonRef} pos="relative" align="center" h="32px" />
          <Button variant="surface" size="xs" onClick={() => setHorizontalFunnel((value) => !value)}>
            <Icon as={TbChartBarPopular} transform={horizontalFunnel ? 'scaleX(-1)' : 'scaleY(-1) rotate(90deg)'} />{' '}
            {horizontalFunnel ? 'Horizontal' : 'Vertical'}
          </Button>
          <TimespanSelect from="/_layout/p/$projectId/funnels/$funnelId" />
        </Flex>
        <AnimatePresence mode="popLayout">
          {horizontalFunnel ? (
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
    </>
  );
}
