import { Box, Button, Icon, IconButton } from '@chakra-ui/react';
import type { Globe } from 'cobe';
import createGlobe from 'cobe';
import { useEffect, useRef } from 'react';
import { TbBolt, TbLock, TbLockOpen, TbPlayerPause, TbPlayerPlay, TbZoomReset } from 'react-icons/tb';
import { NumberCounter } from '@/components/number-counter';
import { TimespanSelect } from '@/components/timespan-select';
import { DESKTOP_GLOBE_CONFIG, MOBILE_GLOBE_CONFIG } from './globe-consts';
import { GlobeMarker } from './globe-marker';
import { GlobeUserPanel } from './globe-user-panel';
import { setMarkerScale, clampGlobeOffset } from './globe-utils';
import { MOCK_GLOBE_MARKERS, MOCK_GLOBE_USER_BUCKETS, MOCK_GLOBE_USERS } from './mock-data';
import { useGlobeState } from './use-globe-state';
import { useGlobeThemeOptions } from './use-globe-theme-options';

interface Props {
  isMobile: boolean;
}

export const GlobeCanvas = ({ isMobile }: Props) => {
  const globeConfig = isMobile ? MOBILE_GLOBE_CONFIG : DESKTOP_GLOBE_CONFIG;
  const globeRootRef = useRef<HTMLDivElement>(null);
  const globeRef = useRef<Globe | null>(null);
  const {
    offsetRef,
    scaleRef,
    rotationRef,
    resetGlobeZoom,
    autoRotate,
    toggleAutoRotate,
    locked,
    toggleLocked,
    startDrag,
    handleWheel,
  } = useGlobeState({
    globeRootRef,
    globeRef,
    globeConfig,
  });
  const { globeThemeOptionsRef } = useGlobeThemeOptions({ globeRef, offsetRef, rotationRef });

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
      markers: MOCK_GLOBE_MARKERS,
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
  }, [globeThemeOptionsRef, offsetRef, scaleRef, rotationRef, globeConfig]);

  return (
    <Box
      ref={globeRootRef}
      w="100%"
      h="100%"
      overflow="hidden"
      pos="relative"
      touchAction="none"
      onPointerDown={startDrag}
      onWheel={handleWheel}
    >
      <Box pos="absolute" top={3} left={3} zIndex="2" display="flex" gap={2}>
        <IconButton
          aria-label={locked ? 'Unlock globe interaction' : 'Lock globe interaction'}
          size="xs"
          variant="surface"
          onClick={toggleLocked}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Icon as={locked ? TbLock : TbLockOpen} />
        </IconButton>
        <IconButton
          aria-label={autoRotate ? 'Pause globe rotation' : 'Start globe rotation'}
          size="xs"
          variant="surface"
          onClick={toggleAutoRotate}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Icon as={autoRotate ? TbPlayerPause : TbPlayerPlay} />
        </IconButton>
        <IconButton
          aria-label="Reset globe zoom"
          size="xs"
          variant="surface"
          onClick={resetGlobeZoom}
          onPointerDown={(event) => event.stopPropagation()}
        >
          <Icon as={TbZoomReset} />
        </IconButton>
      </Box>
      <Box pos="absolute" top={3} right={3} zIndex="2" display="flex" gap={2}>
        <Box onPointerDown={(event) => event.stopPropagation()}>
          <TimespanSelect from="/_layout/p/$projectId/globe" />
        </Box>
      </Box>
      <GlobeUserPanel />
      <Box pos="absolute" bottom={3} right={3} zIndex="2" display="flex" gap={2}>
        <Button variant="surface" size="xs" rounded="full" onPointerDown={(event) => event.stopPropagation()}>
          <TbBolt />{' '}
          <span>
            Events (<NumberCounter value={MOCK_GLOBE_USERS.length} />)
          </span>
        </Button>
      </Box>
      {MOCK_GLOBE_USER_BUCKETS.map((bucket) => (
        <GlobeMarker key={bucket.id} {...bucket} />
      ))}
    </Box>
  );
};
