import { useEffect, useRef } from 'react';
import { useBaseDrag } from '@/hooks/use-base-drag';
import { useGlobeStore } from '@/stores/globe-store';
import type { GlobeUserBucket } from '@/utils/trpc';

interface Props {
  buckets: Array<GlobeUserBucket>;
}

const getPinchDetails = (touches: TouchList) => {
  const first = touches.item(0);
  const second = touches.item(1);
  if (!first || !second) return null;

  const deltaX = second.clientX - first.clientX;
  const deltaY = second.clientY - first.clientY;

  return {
    clientX: (first.clientX + second.clientX) / 2,
    clientY: (first.clientY + second.clientY) / 2,
    distance: Math.hypot(deltaX, deltaY),
  };
};

export const useGlobeController = ({ buckets }: Props) => {
  const {
    refs: { globeRootRef },
    actions,
  } = useGlobeStore();
  const lastPinchDistanceRef = useRef<number | null>(null);
  const suppressTouchDragRef = useRef(false);

  useEffect(() => {
    actions.setBuckets(buckets);
  }, [buckets, actions]);

  useEffect(() => {
    const saveIntervalId = window.setInterval(actions.saveGlobeViewState, 1000);

    return () => {
      window.clearInterval(saveIntervalId);
      actions.saveGlobeViewState();
    };
  }, [actions]);

  useEffect(() => {
    actions.startAnimation();

    return actions.stopAnimation;
  }, [actions]);

  const startDrag = useBaseDrag({
    draggingTolerance: 5,
    onDragStart: (e) => {
      return actions.beginDrag(e.clientX, e.clientY);
    },
    onDrag: (e) => {
      if (e.pointerType === 'touch' && suppressTouchDragRef.current) return;

      actions.drag(e.clientX, e.clientY);
    },
    onDragEnd: () => {
      suppressTouchDragRef.current = false;
      actions.endDrag();
    },
  });

  useEffect(() => {
    const globeRoot = globeRootRef.current;
    if (!globeRoot) return;

    const handleTouchStart = (event: TouchEvent) => {
      if (event.touches.length < 2) return;

      const pinchDetails = getPinchDetails(event.touches);
      if (!pinchDetails || pinchDetails.distance === 0) return;

      event.preventDefault();
      event.stopPropagation();
      suppressTouchDragRef.current = true;
      actions.endDrag();
      lastPinchDistanceRef.current = pinchDetails.distance;
    };

    const handleTouchMove = (event: TouchEvent) => {
      const lastPinchDistance = lastPinchDistanceRef.current;
      if (!lastPinchDistance || event.touches.length < 2) return;

      const pinchDetails = getPinchDetails(event.touches);
      if (!pinchDetails || pinchDetails.distance === 0) return;

      event.preventDefault();
      event.stopPropagation();
      actions.pinchZoomGlobe(
        globeRoot,
        pinchDetails.clientX,
        pinchDetails.clientY,
        pinchDetails.distance / lastPinchDistance,
      );
      lastPinchDistanceRef.current = pinchDetails.distance;
    };

    const handleTouchEnd = (event: TouchEvent) => {
      if (event.touches.length >= 2) {
        const pinchDetails = getPinchDetails(event.touches);
        if (pinchDetails && pinchDetails.distance > 0) {
          lastPinchDistanceRef.current = pinchDetails.distance;
        }
        return;
      }

      lastPinchDistanceRef.current = null;
    };

    globeRoot.addEventListener('wheel', actions.handleWheel, { passive: false });
    globeRoot.addEventListener('touchstart', handleTouchStart, { passive: false });
    globeRoot.addEventListener('touchmove', handleTouchMove, { passive: false });
    globeRoot.addEventListener('touchend', handleTouchEnd);
    globeRoot.addEventListener('touchcancel', handleTouchEnd);

    return () => {
      globeRoot.removeEventListener('wheel', actions.handleWheel);
      globeRoot.removeEventListener('touchstart', handleTouchStart);
      globeRoot.removeEventListener('touchmove', handleTouchMove);
      globeRoot.removeEventListener('touchend', handleTouchEnd);
      globeRoot.removeEventListener('touchcancel', handleTouchEnd);
    };
  }, [globeRootRef, actions]);

  return { startDrag };
};
