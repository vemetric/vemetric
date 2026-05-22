import { Box, useBreakpointValue } from '@chakra-ui/react';
import { createFileRoute } from '@tanstack/react-router';
import { zodValidator } from '@tanstack/zod-adapter';
import { PageDotBackground } from '@/components/page-dot-background';
import { GlobeCanvas } from '@/components/pages/globe/globe-canvas';
import { ProjectInitCard } from '@/components/project-init-card';
import { useTimespanParam } from '@/hooks/use-timespan-param';
import { useSetBreadcrumbs, useSetDocsLink } from '@/stores/header-store';
import { timeSpanSearchMiddleware, timespanSearchSchema } from '@/utils/timespans';
import { trpc } from '@/utils/trpc';

const GLOBE_REFETCH_INTERVAL = 5_000; // 5 seconds

export const Route = createFileRoute('/_layout/p/$projectId/globe')({
  validateSearch: zodValidator(timespanSearchSchema),
  component: RouteComponent,
  search: {
    middlewares: [timeSpanSearchMiddleware],
  },
});

function RouteComponent() {
  const { projectId } = Route.useParams();
  const { timespan, startDate, endDate } = useTimespanParam({ from: '/_layout/p/$projectId/globe' });
  const isMobile = useBreakpointValue({ base: true, md: false }, { ssr: false });
  const { data: markersData, isLoading } = trpc.globe.getMarkers.useQuery(
    { projectId, timespan, startDate, endDate },
    {
      keepPreviousData: true,
      refetchInterval: GLOBE_REFETCH_INTERVAL,
    },
  );
  const {
    data: usersData,
    fetchNextPage,
    hasNextPage,
    isFetchingNextPage,
  } = trpc.globe.listUsers.useInfiniteQuery(
    { projectId, timespan, startDate, endDate },
    {
      keepPreviousData: true,
      getNextPageParam: (lastPage) => lastPage.nextCursor,
      refetchInterval: GLOBE_REFETCH_INTERVAL,
    },
  );
  const panelUsers = usersData?.pages.flatMap((page) => page.users) ?? [];
  const usersCurrentPage = usersData?.pages.length ?? 0;

  useSetBreadcrumbs(['Globe']);
  useSetDocsLink(
    markersData && markersData.isInitialized === false
      ? 'https://vemetric.com/docs/installation'
      : 'https://vemetric.com/docs/globe',
  );

  return (
    <>
      <PageDotBackground />
      {isMobile === undefined ? (
        <Box w="100%" h="100%" overflow="hidden" pos="relative" />
      ) : (
        <GlobeCanvas
          inert={markersData && markersData.isInitialized === false}
          isLoading={isLoading}
          isMobile={isMobile}
          buckets={markersData?.buckets ?? []}
          panelUsers={panelUsers}
          totalUsers={markersData?.totalUsers}
          locatedUsers={markersData?.locatedUsers}
          fetchNextPanelUsers={fetchNextPage}
          hasNextPanelUsersPage={Boolean(hasNextPage)}
          isFetchingNextPanelUsersPage={isFetchingNextPage}
          usersCurrentPage={usersCurrentPage}
        />
      )}
      {markersData && markersData.isInitialized === false && (
        <ProjectInitCard projectToken={markersData.projectToken} />
      )}
    </>
  );
}
