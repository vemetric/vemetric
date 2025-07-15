import { Box, Flex, LinkOverlay } from '@chakra-ui/react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { TIME_SPANS } from '@vemetric/common/charts/timespans';
import { useRef } from 'react';
import { z } from 'zod';
import { PageDotBackground } from '@/components/page-dot-background';
import { HorizontalFunnel } from '@/components/pages/funnels/horizontal-funnel';
import { TimespanSelect } from '@/components/timespan-select';
import { useSetBreadcrumbs } from '@/stores/header-store';

const searchSchema = z.object({
  t: z.enum(TIME_SPANS).optional(),
});

export const Route = createFileRoute('/_layout/p/$projectId/funnels/$funnelId')({
  validateSearch: zodValidator(searchSchema),
  component: RouteComponent,
});

function RouteComponent() {
  const { projectId, funnelId } = Route.useParams();
  const activeUsersButtonRef = useRef<HTMLDivElement>(null);

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
        <Flex mb={6} align="center" gap={2} justify="space-between">
          <div ref={activeUsersButtonRef} />
          <TimespanSelect from="/_layout/p/$projectId/funnels/$funnelId" />
        </Flex>
        <HorizontalFunnel activeUsersButtonRef={activeUsersButtonRef} />
      </Box>
    </>
  );
}
