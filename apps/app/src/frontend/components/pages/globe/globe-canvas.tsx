import { AbsoluteCenter, Box, Button, Icon, IconButton, Spinner } from '@chakra-ui/react';
import type { TimeSpan } from '@vemetric/common/charts/timespans';
import type { Globe } from 'cobe';
import createGlobe from 'cobe';
import { useEffect, useRef } from 'react';
import {
  TbLock,
  TbLockOpen,
  TbMapPinOff,
  TbPlayerPause,
  TbPlayerPlay,
  TbUserOff,
  TbUserSquareRounded,
  TbZoomReset,
} from 'react-icons/tb';
import { TimespanSelect } from '@/components/timespan-select';
import { EmptyState } from '@/components/ui/empty-state';
import type { GlobePanelUser, GlobeUserBucket } from '@/utils/trpc';
import { DESKTOP_GLOBE_CONFIG, MOBILE_GLOBE_CONFIG } from './globe-consts';
import { GlobeMarker } from './globe-marker';
import { GlobeUserPanel } from './globe-user-panel';
import { setMarkerScale, clampGlobeOffset } from './globe-utils';
import { useGlobeState } from './use-globe-state';
import { useGlobeThemeOptions } from './use-globe-theme-options';
import { useGlobeZIndexSync } from './use-globe-zindex-sync';

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
  const globeRootRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<Globe | null>(null);
  const {
    openBucketId,
    selectedMarkerUserId,
    setSelectedMarkerUserId,
    changeOpenMarker,
    isUserPanelOpen,
    setUserPanelOpen,
    openPanelUserOnGlobe,
    offsetRef,
    scaleRef,
    rotationRef,
    resetGlobeZoom,
    autoRotate,
    isDragging,
    toggleAutoRotate,
    locked,
    toggleLocked,
    startDrag,
  } = useGlobeState({
    globeRootRef,
    globeRef,
    globeConfig,
    buckets,
  });
  const { globeThemeOptionsRef } = useGlobeThemeOptions({ globeRef, offsetRef, rotationRef });
  const { setMarkerElement } = useGlobeZIndexSync({ buckets, rotationRef });
  const showNoActiveUsers = !isLoading && totalUsers === 0;
  const showNoLocatedUsers = !isLoading && Boolean(totalUsers && totalUsers > 0) && locatedUsers === 0;

  useEffect(() => {
    const globeRoot = globeRootRef.current;
    if (!globeRoot) return;

    offsetRef.current = clampGlobeOffset(
      offsetRef.current,
      globeRoot.getBoundingClientRect(),
      scaleRef.current,
      globeConfig,
    );
    setMarkerScale(globeRoot, scaleRef.current, globeConfig);

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
      devicePixelRatio: 2,
      width: canvasSize.width,
      height: canvasSize.height,
      ...rotationRef.current,
      mapSamples: globeConfig.mapSamples,
      ...globeThemeOptionsRef.current,
      scale: scaleRef.current,
      offset: offsetRef.current,
      markers: buckets.map((bucket) => ({
        location: bucket.location,
        size: 0,
        id: bucket.id,
      })),
      markerElevation: 0,
    });
    globeRef.current = globe;

    const resizeObserver = new ResizeObserver(() => {
      const renderSize = getCanvasSize();
      offsetRef.current = clampGlobeOffset(
        offsetRef.current,
        globeRoot.getBoundingClientRect(),
        scaleRef.current,
        globeConfig,
      );
      globe.update({
        width: renderSize.width,
        height: renderSize.height,
        offset: offsetRef.current,
        ...rotationRef.current,
      });
    });
    resizeObserver.observe(globeRoot);

    return () => {
      resizeObserver.disconnect();
      if (globeRef.current === globe) {
        globeRef.current = null;
      }
      globe.destroy();

      const cobeRoot = canvas.parentElement;
      if (cobeRoot?.parentElement === globeRoot) {
        cobeRoot.remove();
      } else {
        canvas.remove();
      }
    };
  }, [globeThemeOptionsRef, offsetRef, scaleRef, rotationRef, globeConfig, buckets]);

  return (
    <>
      <Box pos="relative" w="100%" h="100%" inert={isInitialized ? false : true}>
        <Box
          ref={globeRootRef}
          w="100%"
          h="100%"
          overflow="hidden"
          pos="relative"
          touchAction="none"
          zIndex="0"
          cursor={locked ? 'default' : isDragging ? 'grabbing' : 'grab'}
          onPointerDown={startDrag}
          css={{
            '& canvas': {
              animation: isLoading ? 'pulse' : 'none',
            },
          }}
        >
          {buckets.map((bucket) => (
            <GlobeMarker
              key={bucket.id}
              projectId={projectId}
              timespan={timespan}
              startDate={startDate}
              endDate={endDate}
              isOpen={openBucketId === bucket.id}
              setOpen={changeOpenMarker}
              selectedUserId={openBucketId === bucket.id ? selectedMarkerUserId : null}
              setSelectedUserId={setSelectedMarkerUserId}
              {...bucket}
              setMarkerElement={setMarkerElement}
            />
          ))}
        </Box>
        <Box pos="absolute" top={3} left={3} zIndex="2" display="flex" gap={2} pointerEvents="none">
          <IconButton
            aria-label={locked ? 'Unlock globe interaction' : 'Lock globe interaction'}
            size="xs"
            variant="surface"
            onClick={toggleLocked}
            pointerEvents="auto"
          >
            <Icon as={locked ? TbLock : TbLockOpen} />
          </IconButton>
          <IconButton
            aria-label={autoRotate ? 'Pause globe rotation' : 'Start globe rotation'}
            size="xs"
            variant="surface"
            onClick={toggleAutoRotate}
            pointerEvents="auto"
          >
            <Icon as={autoRotate ? TbPlayerPause : TbPlayerPlay} />
          </IconButton>
          <IconButton
            aria-label="Reset globe zoom"
            size="xs"
            variant="surface"
            onClick={resetGlobeZoom}
            pointerEvents="auto"
          >
            <Icon as={TbZoomReset} />
          </IconButton>
        </Box>
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
          isUserPanelOpen={isUserPanelOpen}
          setUserPanelOpen={setUserPanelOpen}
          onSelectUser={openPanelUserOnGlobe}
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
                <Button size="sm" variant="surface" pointerEvents="auto" onClick={() => setUserPanelOpen(true)}>
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
