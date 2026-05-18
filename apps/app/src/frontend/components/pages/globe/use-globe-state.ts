import type { Globe } from 'cobe';
import type { RefObject } from 'react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getThemeTransitioning, subscribeThemeTransition } from '@/components/ui/color-mode';
import { useBaseDrag } from '@/hooks/use-base-drag';
import type { GlobeViewState } from '@/utils/local-storage';
import { globeViewState } from '@/utils/local-storage';
import {
  GLOBE_RESET_DURATION,
  GLOBE_ZOOM_SPEED,
  ZOOM_IN_THETA_PULL,
  ZOOM_OUT_THETA_PULL,
  ROTATION_SPEED,
  type GlobeConfig,
} from './globe-consts';
import {
  clampGlobeOffset,
  clampNumber,
  clampTheta,
  easeOutCubic,
  getCursorFocusOffset,
  getDragSensitivity,
  getInitialGlobeViewState,
  getPreferredTheta,
  getZoomCursorPull,
  setMarkerScale,
} from './globe-utils';

interface Props {
  globeRootRef: RefObject<HTMLDivElement | null>;
  globeRef: RefObject<Globe | null>;
  globeConfig: GlobeConfig;
}

export const useGlobeState = ({ globeRootRef, globeRef, globeConfig }: Props) => {
  const [initialGlobeViewState] = useState<GlobeViewState>(() => getInitialGlobeViewState(globeConfig));

  const autoPhiRef = useRef(0);
  const [autoRotate, setAutoRotate] = useState(initialGlobeViewState.autoRotate);
  const [locked, setLocked] = useState(initialGlobeViewState.locked);
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

  const pointerRef = useRef<{ x: number; y: number; phi: number; theta: number } | null>(null);
  const startDrag = useBaseDrag({
    draggingTolerance: 5,
    onDragStart: (e) => {
      if (lockedRef.current) return false;

      cancelResetAnimation();
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
      pointerRef.current = null;
    },
  });

  const handleWheel = (event: React.WheelEvent<HTMLDivElement>) => {
    event.stopPropagation();

    if (lockedRef.current) return;

    cancelResetAnimation();

    const rect = event.currentTarget.getBoundingClientRect();
    const currentScale = scaleRef.current;
    const nextScale = clampNumber(
      currentScale - event.deltaY * GLOBE_ZOOM_SPEED,
      globeConfig.minScale,
      globeConfig.maxScale,
    );

    if (nextScale <= globeConfig.offsetResetScale) {
      offsetRef.current = [0, 0];
    } else {
      const cursorX = event.clientX - rect.left - rect.width / 2;
      const cursorY = event.clientY - rect.top - rect.height / 2;
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
  };

  return {
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
  };
};
