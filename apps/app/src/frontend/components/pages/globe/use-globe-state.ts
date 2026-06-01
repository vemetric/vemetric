import type { Globe } from 'cobe';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getThemeTransitioning, subscribeThemeTransition } from '@/components/ui/color-mode';
import { toaster } from '@/components/ui/toaster';
import { useBaseDrag } from '@/hooks/use-base-drag';
import type { GlobeViewState } from '@/utils/local-storage';
import { globeViewState } from '@/utils/local-storage';
import type { GlobeJoinedUser, GlobePanelUser, GlobeUserBucket } from '@/utils/trpc';
import {
  GLOBE_RESET_DURATION,
  GLOBE_ZOOM_SPEED,
  ZOOM_IN_THETA_PULL,
  ZOOM_OUT_THETA_PULL,
  ROTATION_SPEED,
  type GlobeConfig,
} from './globe-consts';
import type { GlobeRotation } from './globe-utils';
import {
  clampGlobeOffset,
  clampNumber,
  clampTheta,
  easeOutCubic,
  getCursorFocusOffset,
  getDragSensitivity,
  getFocusedRotation,
  getInitialGlobeViewState,
  getLocationRotation,
  getPreferredTheta,
  getZoomCursorPull,
  interpolateOffset,
  interpolateRotation,
  setMarkerScale,
} from './globe-utils';

interface Props {
  globeRootRef: RefObject<HTMLDivElement | null>;
  globeRef: RefObject<Globe | null>;
  globeConfig: GlobeConfig;
  buckets: Array<GlobeUserBucket>;
}

const GLOBE_WHEEL_IGNORE_SELECTOR = '[data-globe-wheel-ignore]';

export const useGlobeState = ({ globeRootRef, globeRef, globeConfig, buckets }: Props) => {
  const [initialGlobeViewState] = useState<GlobeViewState>(() => getInitialGlobeViewState(globeConfig));

  const [isUserPanelOpen, setUserPanelOpen] = useState(false);
  const [openBucketId, setOpenBucketId] = useState<string | null>(null);
  const [selectedMarkerUserId, setSelectedMarkerUserId] = useState<string | null>(null);
  const autoPhiRef = useRef(0);
  const [autoRotate, setAutoRotate] = useState(initialGlobeViewState.autoRotate);
  const [locked, setLocked] = useState(initialGlobeViewState.locked);
  const [isDragging, setIsDragging] = useState(false);
  const autoRotateRef = useRef(autoRotate);
  const lockedRef = useRef(locked);
  // TODO: make it smaller on mobile
  const scaleRef = useRef(initialGlobeViewState.scale);
  const offsetRef = useRef<[number, number]>(initialGlobeViewState.offset);
  const dragRotationRef = useRef({ phi: initialGlobeViewState.phi, theta: initialGlobeViewState.theta });
  const rotationRef = useRef({
    phi: autoPhiRef.current + dragRotationRef.current.phi,
    theta: clampTheta(dragRotationRef.current.theta, scaleRef.current, globeConfig),
  });

  const changeOpenMarker = useCallback((bucketId: string, open: boolean) => {
    setSelectedMarkerUserId(null);
    setOpenBucketId(open ? bucketId : null);
  }, []);

  const saveGlobeViewState = () => {
    globeViewState.set({
      scale: scaleRef.current,
      offset: offsetRef.current,
      phi: rotationRef.current.phi,
      theta: rotationRef.current.theta,
      autoRotate: autoRotateRef.current,
      locked: lockedRef.current,
    });
  };

  useEffect(() => {
    const saveIntervalId = window.setInterval(saveGlobeViewState, 1000);

    return () => {
      window.clearInterval(saveIntervalId);
      saveGlobeViewState();
    };
  }, []);

  useEffect(() => {
    let frameId: number;
    let isRotationPaused = getThemeTransitioning();

    const unsubscribeThemeTransition = subscribeThemeTransition((isTransitioning) => {
      const frozenDragPhi = rotationRef.current.phi - autoPhiRef.current;
      const frozenDragTheta = clampTheta(rotationRef.current.theta, scaleRef.current, globeConfig);

      dragRotationRef.current = { phi: frozenDragPhi, theta: frozenDragTheta };

      if (!isTransitioning) {
        autoPhiRef.current = rotationRef.current.phi - frozenDragPhi;
      }

      isRotationPaused = isTransitioning;
    });

    function animate() {
      if (!isRotationPaused && autoRotateRef.current) {
        autoPhiRef.current += ROTATION_SPEED;
      }

      rotationRef.current = {
        phi: autoPhiRef.current + dragRotationRef.current.phi,
        theta: clampTheta(dragRotationRef.current.theta, scaleRef.current, globeConfig),
      };
      globeRef.current?.update({ ...rotationRef.current, scale: scaleRef.current, offset: offsetRef.current });
      frameId = requestAnimationFrame(animate);
    }
    animate();

    return () => {
      cancelAnimationFrame(frameId);
      cancelResetAnimation();
      unsubscribeThemeTransition();
    };
  }, [globeRef, globeConfig]);

  const updateGlobeView = useCallback(
    (scale: number, offset: [number, number]) => {
      const globeRoot = globeRootRef.current;

      scaleRef.current = scale;
      offsetRef.current = offset;

      if (globeRoot) {
        setMarkerScale(globeRoot, scale, globeConfig);
      }

      globeRef.current?.update({ scale, offset, ...rotationRef.current });
    },
    [globeRootRef, globeRef, globeConfig],
  );

  const resetFrameRef = useRef<number | null>(null);
  const cancelResetAnimation = () => {
    if (resetFrameRef.current === null) return;

    cancelAnimationFrame(resetFrameRef.current);
    resetFrameRef.current = null;
  };
  const resetGlobeZoom = () => {
    const startScale = scaleRef.current;
    const startOffset = offsetRef.current;
    const startedAt = performance.now();

    cancelResetAnimation();

    const animateReset = (now: number) => {
      const progress = easeOutCubic(clampNumber((now - startedAt) / GLOBE_RESET_DURATION, 0, 1));
      const nextScale = startScale + (globeConfig.defaultScale - startScale) * progress;
      const nextOffset: [number, number] = [
        startOffset[0] + (0 - startOffset[0]) * progress,
        startOffset[1] + (0 - startOffset[1]) * progress,
      ];

      updateGlobeView(nextScale, nextOffset);

      if (progress < 1) {
        resetFrameRef.current = requestAnimationFrame(animateReset);
        return;
      }

      resetFrameRef.current = null;
      updateGlobeView(globeConfig.defaultScale, [0, 0]);
    };

    resetFrameRef.current = requestAnimationFrame(animateReset);
  };

  const toggleAutoRotate = () => {
    const nextAutoRotate = !autoRotateRef.current;

    autoRotateRef.current = nextAutoRotate;
    setAutoRotate(nextAutoRotate);
  };

  const toggleLocked = () => {
    const nextLocked = !lockedRef.current;

    lockedRef.current = nextLocked;
    setLocked(nextLocked);
  };

  const setRotationAndOffset = useCallback((rotation: GlobeRotation, offset: [number, number]) => {
    dragRotationRef.current = rotation;
    rotationRef.current = rotation;
    offsetRef.current = offset;
  }, []);

  const focusGlobeLocation = useCallback(
    (location: [number, number]) => {
      cancelResetAnimation();

      if (autoRotateRef.current) {
        autoRotateRef.current = false;
        setAutoRotate(false);
      }

      const startRotation = {
        phi: rotationRef.current.phi,
        theta: clampTheta(rotationRef.current.theta, scaleRef.current, globeConfig),
      };
      const targetRotation = getFocusedRotation(
        startRotation,
        getLocationRotation(location, scaleRef.current, globeConfig),
      );
      const startOffset = offsetRef.current;
      const startedAt = performance.now();

      autoPhiRef.current = 0;

      const animateFocus = (now: number) => {
        const progress = easeOutCubic(clampNumber((now - startedAt) / GLOBE_RESET_DURATION, 0, 1));
        setRotationAndOffset(
          interpolateRotation(startRotation, targetRotation, progress),
          interpolateOffset(startOffset, [0, 0], progress),
        );

        if (progress < 1) {
          resetFrameRef.current = requestAnimationFrame(animateFocus);
          return;
        }

        resetFrameRef.current = null;
        setRotationAndOffset(targetRotation, [0, 0]);
      };

      resetFrameRef.current = requestAnimationFrame(animateFocus);
    },
    [globeConfig, setRotationAndOffset],
  );

  const pointerRef = useRef<{ x: number; y: number; phi: number; theta: number } | null>(null);
  const startDrag = useBaseDrag({
    draggingTolerance: 5,
    onDragStart: (e) => {
      if (lockedRef.current) return false;

      cancelResetAnimation();
      if (autoRotateRef.current) {
        autoRotateRef.current = false;
        setAutoRotate(false);
      }
      setIsDragging(true);
      pointerRef.current = {
        x: e.clientX,
        y: e.clientY,
        phi: dragRotationRef.current.phi,
        theta: clampTheta(dragRotationRef.current.theta, scaleRef.current, globeConfig),
      };
      return undefined;
    },
    onDrag: (e) => {
      if (pointerRef.current !== null) {
        const deltaX = e.clientX - pointerRef.current.x;
        const deltaY = e.clientY - pointerRef.current.y;
        const dragSensitivity = getDragSensitivity(scaleRef.current, globeConfig);

        dragRotationRef.current = {
          phi: pointerRef.current.phi + deltaX / dragSensitivity,
          theta: clampTheta(pointerRef.current.theta + deltaY / dragSensitivity, scaleRef.current, globeConfig),
        };
      }
    },
    onDragEnd: () => {
      setIsDragging(false);
      pointerRef.current = null;
    },
  });

  const zoomGlobe = useCallback(
    (target: HTMLDivElement, clientX: number, clientY: number, deltaY: number) => {
      if (lockedRef.current) return;

      cancelResetAnimation();

      const rect = target.getBoundingClientRect();
      const currentScale = scaleRef.current;
      const nextScale = clampNumber(
        currentScale - deltaY * GLOBE_ZOOM_SPEED,
        globeConfig.minScale,
        globeConfig.maxScale,
      );

      if (nextScale <= globeConfig.offsetResetScale) {
        offsetRef.current = [0, 0];
      } else {
        const cursorX = clientX - rect.left - rect.width / 2;
        const cursorY = clientY - rect.top - rect.height / 2;
        const scaleRatio = nextScale / currentScale;
        const nextOffset: [number, number] = [
          cursorX - (cursorX - offsetRef.current[0]) * scaleRatio,
          cursorY - (cursorY - offsetRef.current[1]) * scaleRatio,
        ];

        if (nextScale > currentScale) {
          const cursorFocusOffset = getCursorFocusOffset(rect, cursorX, cursorY, nextScale, globeConfig);
          const cursorPull = getZoomCursorPull(currentScale, nextScale, globeConfig);
          nextOffset[0] += (cursorFocusOffset[0] - nextOffset[0]) * cursorPull;
          nextOffset[1] += (cursorFocusOffset[1] - nextOffset[1]) * cursorPull;
        }

        offsetRef.current = clampGlobeOffset(nextOffset, rect, nextScale, globeConfig);
      }

      if (nextScale !== currentScale) {
        const preferredTheta = getPreferredTheta(nextScale, globeConfig);
        const thetaPull = nextScale > currentScale ? ZOOM_IN_THETA_PULL : ZOOM_OUT_THETA_PULL;
        dragRotationRef.current = {
          ...dragRotationRef.current,
          theta: clampTheta(
            dragRotationRef.current.theta + (preferredTheta - dragRotationRef.current.theta) * thetaPull,
            nextScale,
            globeConfig,
          ),
        };
      }
      updateGlobeView(nextScale, offsetRef.current);
    },
    [globeConfig, updateGlobeView],
  );

  useEffect(() => {
    const globeRoot = globeRootRef.current;
    if (!globeRoot) return;

    const handleNativeWheel = (event: WheelEvent) => {
      if (event.target instanceof Element && event.target.closest(GLOBE_WHEEL_IGNORE_SELECTOR)) {
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      zoomGlobe(globeRoot, event.clientX, event.clientY, event.deltaY);
    };

    globeRoot.addEventListener('wheel', handleNativeWheel, { passive: false });

    return () => {
      globeRoot.removeEventListener('wheel', handleNativeWheel);
    };
  }, [globeRootRef, zoomGlobe]);

  const openPanelUserOnGlobe = (user: GlobePanelUser | GlobeJoinedUser) => {
    if (!user.globeBucketId) {
      toaster.create({
        id: 'globe-no-location',
        title: 'No location data',
        description: 'This user cannot be shown on the globe because no location is available for this time range.',
        type: 'info',
      });
      return;
    }

    const bucket = buckets.find((candidate) => candidate.id === user.globeBucketId);
    if (bucket) {
      focusGlobeLocation(bucket.location);
    }

    setUserPanelOpen(false);
    setOpenBucketId(user.globeBucketId);
    setSelectedMarkerUserId(user.id);
  };

  return {
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
  };
};
