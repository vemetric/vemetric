import { AbsoluteCenter, Box, Button, Icon, Spinner } from '@chakra-ui/react';
import type { TimeSpan } from '@vemetric/common/charts/timespans';
import createGlobe from 'cobe';
import { useEffect } from 'react';
import { TbMapPinOff, TbUserOff, TbUserSquareRounded } from 'react-icons/tb';
import { useSnapshot } from 'valtio';
import { TimespanSelect } from '@/components/timespan-select';
import { EmptyState } from '@/components/ui/empty-state';
import { useGlobeStore } from '@/stores/globe-store';
import type { GlobePanelUser, GlobeUserBucket } from '@/utils/trpc';
import { DESKTOP_GLOBE_CONFIG, MOBILE_GLOBE_CONFIG } from './globe-consts';
import { GlobeControls } from './globe-controls';
import { GlobeMarkers } from './globe-markers';
import { GlobeSurface } from './globe-surface';
import { GlobeUserPanel } from './globe-user-panel';
import { useGlobeController } from './use-globe-controller';
import { COBE_DEVICE_PIXEL_RATIO, useGlobeMarkerSync } from './use-globe-marker-sync';
import { useGlobeThemeOptions } from './use-globe-theme-options';

interface Props {
  isInitialized: boolean;
  projectId: string;
  timespan: TimeSpan;
  startDate?: string;
  endDate?: string;
  isLoading: boolean;
  isMobile: boolean;
  buckets: GlobeUserBucket[];
  panelUsers: GlobePanelUser[];
  totalUsers?: number;
  locatedUsers?: number;
  fetchNextPanelUsers: () => void;
  hasNextPanelUsersPage: boolean;
  isFetchingNextPanelUsersPage: boolean;
  usersCurrentPage: number;
}

export const GlobeCanvas = (props: Props) => {
  const {
    isInitialized,
    projectId,
    timespan,
    startDate,
    endDate,
    isMobile,
    buckets,
    panelUsers,
    totalUsers,
    locatedUsers,
    fetchNextPanelUsers,
    hasNextPanelUsersPage,
    isFetchingNextPanelUsersPage,
    usersCurrentPage,
    isLoading,
  } = props;

  const globeConfig = isMobile ? MOBILE_GLOBE_CONFIG : DESKTOP_GLOBE_CONFIG;
  const {
    store,
    actions,
    refs: { globeRef, globeRootRef, scaleRef, offsetRef, rotationRef },
  } = useGlobeStore();
  const { isInitialAnimating } = useSnapshot(store);
  const { startDrag } = useGlobeController({
    buckets,
  });
  const { globeThemeOptionsRef } = useGlobeThemeOptions();
  const { setMarkerElement } = useGlobeMarkerSync({ buckets });
  const showNoActiveUsers = !isLoading && totalUsers === 0;
  const showNoLocatedUsers = !isLoading && Boolean(totalUsers && totalUsers > 0) && locatedUsers === 0;

  useEffect(() => {
    const globeRoot = globeRootRef.current;
    if (!globeRoot) return;

    actions.clampGlobeOffsetToRoot();
    actions.syncMarkerScale();

    const getCanvasSize = () => {
      const { width, height } = globeRoot.getBoundingClientRect();

      return {
        width: Math.max(1, Math.round(width)) * 2,
        height: Math.max(1, Math.round(height)) * 2,
      };
    };

    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    canvas.style.display = 'block';

    globeRoot.append(canvas);

    const canvasSize = getCanvasSize();
    const globe = createGlobe(canvas, {
      devicePixelRatio: COBE_DEVICE_PIXEL_RATIO,
      width: canvasSize.width,
      height: canvasSize.height,
      ...rotationRef.current,
      mapSamples: globeConfig.mapSamples,
      ...globeThemeOptionsRef.current,
      scale: scaleRef.current,
      offset: offsetRef.current,
      markers: [],
      markerElevation: 0,
    });
    globeRef.current = globe;

    const resizeObserver = new ResizeObserver(() => {
      const renderSize = getCanvasSize();
      actions.clampGlobeOffsetToRoot();
      actions.updateGlobeSize(renderSize.width, renderSize.height);
    });
    resizeObserver.observe(globeRoot);

    return () => {
      resizeObserver.disconnect();
      globeRef.current = null;
      globe.destroy();

      const cobeRoot = canvas.parentElement;
      if (cobeRoot?.parentElement === globeRoot) {
        cobeRoot.remove();
      } else {
        canvas.remove();
      }
    };
  }, [globeThemeOptionsRef, globeRef, globeRootRef, offsetRef, scaleRef, rotationRef, globeConfig, actions]);

  return (
    <>
      <Box pos="relative" w="100%" h="100%" inert={!isInitialized || isInitialAnimating}>
        <GlobeSurface isLoading={isLoading} startDrag={startDrag}>
          <GlobeMarkers
            projectId={projectId}
            timespan={timespan}
            startDate={startDate}
            endDate={endDate}
            buckets={buckets}
            setMarkerElement={setMarkerElement}
          />
        </GlobeSurface>
        <GlobeControls />
        <Box pos="absolute" top={3} right={3} zIndex="2" display="flex" gap={2}>
          <Box>
            <TimespanSelect from="/_layout/p/$projectId/globe" />
          </Box>
        </Box>
        <GlobeUserPanel
          isInitialized={isInitialized}
          projectId={projectId}
          timespan={timespan}
          startDate={startDate}
          endDate={endDate}
          users={panelUsers}
          totalUsers={totalUsers}
          fetchNextPage={fetchNextPanelUsers}
          hasNextPage={hasNextPanelUsersPage}
          isFetchingNextPage={isFetchingNextPanelUsersPage}
          usersCurrentPage={usersCurrentPage}
        />
        {(showNoActiveUsers || showNoLocatedUsers) && (
          <AbsoluteCenter zIndex="1" pointerEvents="none" w="min(420px, calc(100% - 32px))">
            <EmptyState
              icon={<Icon as={showNoLocatedUsers ? TbMapPinOff : TbUserOff} />}
              title={showNoLocatedUsers ? 'No located users' : 'No active users'}
              description={
                showNoLocatedUsers
                  ? 'Users were active in this time range, but none of them have location data.'
                  : 'No users were active in the selected time range.'
              }
              bg="bg/90"
              _dark={{ bg: 'bg/80' }}
              border="1px solid"
              borderColor="border"
              rounded="md"
              px={6}
              py={5}
              backdropFilter="blur(8px)"
            >
              {showNoLocatedUsers && (
                <Button size="sm" variant="surface" pointerEvents="auto" onClick={() => actions.setUserPanelOpen(true)}>
                  <Icon as={TbUserSquareRounded} />
                  View users{totalUsers ? ` (${totalUsers})` : ''}
                </Button>
              )}
            </EmptyState>
          </AbsoluteCenter>
        )}
      </Box>
      {isLoading && (
        <AbsoluteCenter>
          <Spinner size="xl" borderWidth="3px" opacity="0.6" />
        </AbsoluteCenter>
      )}
    </>
  );
};
